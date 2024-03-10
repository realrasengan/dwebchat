## Preface

The internet, today, doesn't look anything like it did when I was first lucky enough to learn about it. Back then, the internet was __actually__ decentralized. We 
all ran our own machines with our own servers. I could send e-mails to my colleagues which would land on their servers, and vice versa. It was good.

Fast forward to today, not only has this disappeared but, to make matters worse, even if you wanted to be a __peer__ on the internet, not just a __slave__, you would have to 
compete with others for a limited number of IPv4 addresses (read: $$$). After all, on today's internet, without IPv4, you're likely connecting via NAT and cannot actually 
serve directly since your ports, and computer, will not be reachable. You're land locked and subservient to your master.

The moats of these masters has only further deepened. For example, with the majority of the people of earth using GMail which automatically marks all non-major e-mail 
providers' e-mails as SPAM, you're ultimately forced to either use GMail or another one of the majors for deliverability. This comes with the unfortunate non-benefits of 
allowing others to read all of your e-mails should they so want to.

After sponsoring freenode for nearly a decade, I found myself in a predicament where I became the owner of freenode, when I responded favorably to a request from freenode's 
previous owner, which led to a group of volunteers, probably rightfully so, becoming unhappy about it. At the time, however, there wasn't any easy way to share ownership.
Since then, Joseon and its legal jurisdictions for DAOs and crypto exists, so as a legal matter it is now possible.

However, from a technical matter, the internet and its protocols should be peer to peer, the way it was meant to be, not master-slave. I had thought to myself, how could 
netizens, like IRC users, really **__own__** their network, and what exactly is a network?

In the end, the network is the identity services, the chat relay, and the users.

Historically, the identity services and the relay had to be centralized. Today, with Handshake, identity no longer ever needs to be centralized. Further, with IPv6, relays no 
longer matter.

All the other 'decentralized' services that rely on centralized servers, databases and systems are actually just centralized services masquerading as decentralized services.

However, this is no facade: **The combination of Handshake + IPv6 creates a decentralized web/internet that does not need centralized services/servers, period.**

## Introducing dwebchat

dwebchat, is direct, peer to peer chat. The concept of peer to peer chat from a technological perspective isn't anything new. Anyone can write an application to do 
this in the matter of minutes. However, coupled with Handshake, this introduces an exhorbitant amount of pleasantries.

1. You can now authenticate that you are speaking to who you think you are, without a central server or the need to trust a human web of trust operator.
2. You can now perform end to end encrypted, perfectly forward secret communications with someone, without a central server or the need to trust a human web of trust 
operator.

### Requirements

1. Your machine must have a public IP and ports 3600+3601 open. Your ISP probably provides one. If you don't have one, you can easily get one from [IPv6rs](https://ipv6.rs)

2. You must have a [Handshake](https://handshake.org) name.

3. For this implementation, you'll need a newish version of nodejs (20) and a *nix machine. WSL is probably fine with a GUI.

### How to use

1. Clone the repo.
```
git clone https://github.com/realrasengan/dwebchat
cd dwebchat
```

2. Install all the npm's.
```
npm init
```

3. Run the setup.
```
./setup.sh
```

4. Enter your SSL hash and IP into the Resource Records on Bob Wallet per the setup.sh instructions at the end.

5. Copy and paste your Bob node API key to `bob.key`
```
echo "KEY-GOES-HERE" > bob.key
```

6. Run
```
npm start
```

###  Protocol

I didn't really devise a protocol, but this is how this works:

Alice -> Bob
1. Alice gets Bob's Cert from unencrypted :3601/cert and verifies it against the onchain Hash.

2. Alice posts a signed message to encrypted :3600/post

3. Bob gets Alice's Cert from unencrypted :3601/cert and verifies it against the onchain Hash.

4. If correct, Bob receives it and can respond if he wants to.

#### What's Next

In addition to what exists now, the next step will be to:

1. Add chatroom support by way of relay; in other words, the owner of the chatroom will host the chatroom. There is an expectation that one owns their room, so this is an 
acceptable centralization.

2. Add `bang path` cryptographic onion routing to stop the 'who sent to who' issue.

For example, Alice -> Bob may send like:

alice -> jack!richard!steve!elizabeth!bob!jordann!roman

richard knows he got the message from jack and it must go to steve, but doesn't know the contents or anything else.

When bob receives it, he is able to decrypt, but he keeps forwarding the encrypted msg on.

Now, nobody knows who the message was actually destined for since there was never an 'exit', other than Alice and Bob.

### Copyright

Copyright (c) 2024 Andrew Lee <andrew@joseon.com>

All Rights Reserved

This is MIT licensed.
