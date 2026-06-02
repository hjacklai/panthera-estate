#!/usr/bin/perl
use strict;
use warnings;
use IO::Socket::INET;
use IO::Select;
use POSIX ":sys_wait_h";

$| = 1;
$SIG{PIPE} = 'IGNORE';
$SIG{CHLD} = sub { while (waitpid(-1, WNOHANG) > 0) {} };

my $port = $ENV{PORT} || 8765;
my $root = $ENV{ROOT} || '.';

my $sock = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Proto     => 'tcp',
    Listen    => 32,
    ReuseAddr => 1,
) or die "Could not start server on port $port: $!\n";

print "Serving '$root' on http://127.0.0.1:$port/\n";

sub guess_mime {
    my $f = shift;
    return 'text/html; charset=utf-8' if $f =~ /\.html?$/i;
    return 'text/css; charset=utf-8'  if $f =~ /\.css$/i;
    return 'application/javascript; charset=utf-8' if $f =~ /\.m?js$/i;
    return 'image/jpeg' if $f =~ /\.jpe?g$/i;
    return 'image/png'  if $f =~ /\.png$/i;
    return 'image/svg+xml' if $f =~ /\.svg$/i;
    return 'image/webp' if $f =~ /\.webp$/i;
    return 'image/avif' if $f =~ /\.avif$/i;
    return 'image/x-icon' if $f =~ /\.ico$/i;
    return 'application/pdf' if $f =~ /\.pdf$/i;
    return 'application/json; charset=utf-8' if $f =~ /\.json$/i;
    return 'text/plain; charset=utf-8' if $f =~ /\.(md|txt)$/i;
    return 'font/woff2' if $f =~ /\.woff2$/i;
    return 'font/woff'  if $f =~ /\.woff$/i;
    return 'application/octet-stream';
}

sub url_decode {
    my $s = shift;
    $s =~ s/\+/ /g;
    $s =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
    return $s;
}

sub send_status {
    my ($client, $code, $msg) = @_;
    my $body = "$msg\n";
    print $client "HTTP/1.0 $code $msg\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " . length($body) . "\r\nConnection: close\r\n\r\n$body";
}

sub handle {
    my $client = shift;
    my $req_line = <$client>;
    return unless defined $req_line;
    chomp $req_line;
    while (my $h = <$client>) { last if $h =~ /^\s*$/; }

    unless ($req_line =~ m{^GET\s+(\S+)\s+HTTP}) {
        send_status($client, 400, 'Bad Request');
        return;
    }
    my $path = $1;
    $path =~ s{\?.*}{};
    $path = url_decode($path);
    $path =~ s{^/+}{};
    $path = 'index.html' if $path eq '' || $path =~ m{/$};
    $path =~ s{\\}{/}g;
    $path =~ s{\.\./}{}g;

    my $file = "$root/$path";
    $file = "$file/index.html" if -d $file;

    unless (-f $file) {
        send_status($client, 404, "Not Found: $path");
        print "  404  /$path\n";
        return;
    }

    open my $fh, '<:raw', $file or do { send_status($client, 500, 'open failed'); return; };
    local $/;
    my $body = <$fh>;
    close $fh;
    my $mime = guess_mime($file);
    print $client "HTTP/1.0 200 OK\r\n";
    print $client "Content-Type: $mime\r\n";
    print $client "Content-Length: " . length($body) . "\r\n";
    print $client "Cache-Control: no-store\r\n";
    print $client "Access-Control-Allow-Origin: *\r\n";
    print $client "Connection: close\r\n";
    print $client "\r\n";
    print $client $body;
    print "  200  /$path  ($mime, " . length($body) . "b)\n";
}

# Multiplex many concurrent connections in a single process. Each accepted
# socket sits in $clients with the time it joined; if it doesn't send a full
# request within $TIMEOUT seconds it gets evicted, so idle keep-alive sockets
# from Chrome can't choke new traffic.
my $TIMEOUT = 5;
my $sel = IO::Select->new($sock);
my %joined;     # fileno => epoch when this client connected
my %buf;        # fileno => bytes read so far (header+body until \r\n\r\n)
my %sockmap;    # fileno => socket handle (so we can close on timeout)

while (1) {
    my @ready = $sel->can_read(1);
    my $now = time;
    for my $h (@ready) {
        if ($h == $sock) {
            my $client = $sock->accept or next;
            $client->blocking(0);
            $sel->add($client);
            my $fn = fileno($client);
            $joined{$fn} = $now;
            $buf{$fn} = '';
            $sockmap{$fn} = $client;
            next;
        }
        my $fn = fileno($h);
        my $chunk;
        my $n = sysread($h, $chunk, 8192);
        if (!defined $n) {
            # EAGAIN on non-blocking, just wait
            next;
        }
        if ($n == 0) {
            # peer closed
            $sel->remove($h);
            delete $joined{$fn}; delete $buf{$fn}; delete $sockmap{$fn};
            close $h;
            next;
        }
        $buf{$fn} .= $chunk;
        if ($buf{$fn} =~ /\r\n\r\n/) {
            # Full request headers received, serve it (one-shot, then close).
            $h->blocking(1);
            my @lines = split /\r\n/, $buf{$fn};
            my $req_line = $lines[0] || '';
            if ($req_line =~ m{^GET\s+(\S+)\s+HTTP}) {
                my $path = $1;
                $path =~ s{\?.*}{};
                $path = url_decode($path);
                $path =~ s{^/+}{};
                $path = 'index.html' if $path eq '' || $path =~ m{/$};
                $path =~ s{\\}{/}g;
                $path =~ s{\.\./}{}g;
                my $file = "$root/$path";
                $file = "$file/index.html" if -d $file;
                if (-f $file) {
                    if (open my $fh, '<:raw', $file) {
                        local $/;
                        my $body = <$fh>;
                        close $fh;
                        my $mime = guess_mime($file);
                        print $h "HTTP/1.0 200 OK\r\n";
                        print $h "Content-Type: $mime\r\n";
                        print $h "Content-Length: " . length($body) . "\r\n";
                        print $h "Cache-Control: no-store\r\n";
                        print $h "Access-Control-Allow-Origin: *\r\n";
                        print $h "Connection: close\r\n";
                        print $h "\r\n";
                        print $h $body;
                        print "  200  /$path  ($mime, " . length($body) . "b)\n";
                    } else {
                        send_status($h, 500, 'open failed');
                    }
                } else {
                    # Serve 404.html body if present (mirrors what Bluehost will do)
                    my $errfile = "$root/404.html";
                    if (-f $errfile && open my $efh, '<:raw', $errfile){
                        local $/;
                        my $body = <$efh>;
                        close $efh;
                        print $h "HTTP/1.0 404 Not Found\r\n";
                        print $h "Content-Type: text/html; charset=utf-8\r\n";
                        print $h "Content-Length: " . length($body) . "\r\n";
                        print $h "Cache-Control: no-store\r\n";
                        print $h "Connection: close\r\n";
                        print $h "\r\n";
                        print $h $body;
                    } else {
                        send_status($h, 404, "Not Found: $path");
                    }
                    print "  404  /$path\n";
                }
            } else {
                send_status($h, 400, 'Bad Request');
            }
            $sel->remove($h);
            delete $joined{$fn}; delete $buf{$fn}; delete $sockmap{$fn};
            close $h;
        }
    }
    # Evict idle connections.
    for my $fn (keys %joined) {
        if ($now - $joined{$fn} > $TIMEOUT) {
            my $h = $sockmap{$fn};
            $sel->remove($h) if $h;
            delete $joined{$fn}; delete $buf{$fn}; delete $sockmap{$fn};
            close $h if $h;
        }
    }
}
