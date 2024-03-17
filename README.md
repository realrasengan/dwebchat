# IRC (formerly dwebchat)

This is POC for Internet Relay Chat. This is the IRC that was meant to be built, but IPv4 destroyed the ability for everyone to be a peer online.

## How it Works

1. Everyone is a server, and everyone is a client.

2. Private messages send directly from person to person (client <-> server).

3. Channels are relays hosted by users - if you own the name 'joseon' then you own the channel namespace 'joseon' and 'joseon/<anything>'

4. Protocol is RFC1459

## Requirements

You must have an externally reachable IP and ports open (3600, 3601). Additionally, you must be able to bind 6667 on localhost. If you don't have one, you can get it at 
[IPv6rs](https://ipv6.rs) and easily use it. This is much easier than trying to configure your router/expose your home IP/etc.

For a decentralized internet, IPv6 is mandatory since there are not enough IPs for everyone on IPv4.

## Notes

This is in POC, Pre-Alpha form. Use at your own discretion. It "works" but not for anything serious, yet.

## Instructions

1. Install nodeJS 20

2. Install npms
```
npm install express node-fetch body-parser ws
```

3. Run setup.sh
```
./setup.sh
```

4. Follow the instructions to update your name on Bob, hsd, or Namebase I guess?

5. Make sure you have Bob running and copy your node API key to bob.key in the root folder of this program

6. Run
```
node index.js
```

7. Connect to localhost 6667 with your IRC client.

## What works

1. PRIVMSG

Messaging, directly, from person to person, is working. Messaging to channels with relay appears to work.

2. JOIN

Join appears to work.

3. PART

Part appears to work.

4. NAMES

Names appears to work.

5. QUIT

Quit works.

## Copyright

Copyright (c) 2024 Andrew Lee <andrew@joseon.com>

All Rights Reserved.

MIT Licensed.

