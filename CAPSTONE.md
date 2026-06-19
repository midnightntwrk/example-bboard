# Capstone: Multi-Post Bulletin Board (Track A)

## What I built and why

The original bulletin board could only hold one message at a time. Once someone posted, the board was "occupied" and nobody else could post until it was taken down. I extended it so the board can hold up to five posts at once, each owned by whoever posted it.

To do that, I changed how the board stores its data. Instead of a single `message` and a single `owner`, I made a small record called `Post` that holds a message together with its owner. Then I keep all the posts in a `Map` (basically a lookup table), where each post has its own number, or "id" (0, 1, 2, and so on). A counter called `nextId` hands out those ids and never reuses one. So now many posts can sit on the board at the same time, and each one remembers who posted it.

I also added a limit of five so the board can't grow forever. Before adding a post, the contract checks how many posts already exist and refuses if it's full.

One choice I want to point out: the original contract had a global "sequence" number it used to keep the owner hashes from repeating. In my version each post already has a unique id, so I just use the post id for that job instead. That felt simpler than keeping a separate counter.

## The main Compact things I used

- A witness (`localSecretKey`) — how the contract gets the poster's secret key from their own machine without that key ever going on-chain.
- `disclose()` — Compact treats anything private as secret by default, so you have to say explicitly when something is allowed to become public. In my `post` circuit I use it twice: once for the message (so it appears on the board) and once for the owner hash (so the board can store who owns the post). I don't need it on the post id when adding a post, because that id comes from the public counter, not from anything hidden or secret.
- Assertions (`assert`) — I use three as guard rails: one that stops you posting to a full board, one that checks the post you're taking down actually exists, and one that checks you're really the owner before letting you remove it.
- A `Map` and its operations — `size` to count posts, `member` to check an id exists, `lookup` to read a post, `insert` to add one, and `remove` to take one down.
- Pure circuits (`publicKey` and `maxPosts`) — small helpers. `publicKey` turns a secret key plus a post id into a one way hash, and `maxPosts` just returns the limit, 5.
- `persistentHash` — the one-way hashing that turns the secret key into the owner "fingerprint" that's safe to show publicly.

In `takeDown(id)`, the contract rebuilds the owner hash from your key and that post's id and checks it matches the stored one. Because that check is only inside an `assert`, I don't have to disclose it — you only disclose things you store or return, not things you just compare.

## Privacy

The secret key stays private and never leaves the user's machine. What's public is the messages and a one-way owner hash for each post. You can't work backwards from the hash to the key.

I kept the same privacy idea as the original, just applied to every post. Because each post's owner hash is mixed with that post's unique id, two posts by the same person come out as two different hashes. So someone watching the chain can't tell that the same person made both.

## Things it doesn't do / what I'd change with more time

- The limit is fixed at five, and the id counter keeps growing forever (taken-down ids are never reused).
- Messages are public on purpose — this board is for public notes, not private ones.
- Taking a post down has to reveal which id was removed, so an observer can see which post disappeared (just not who removed it).
- You can't edit a post, only post and take it down.
- The CLI just lists every post with no paging or sorting.

As someone who doesn't code for a living, the parts that delayed me the most were honestly about getting everything to run, not the feature itself. The compiler expected a newer runtime version than the project had pinned (this frustrated me), and the one that really got me was the spaces in my folder name quietly breaking the path to the ZK keys, so the contract failed to deploy for a reason that had nothing to do with my code. I also couldn't get the public testnet to sync, so I had to test everything locally in standalone mode. On the contract side, the idea that took longest to click was `disclose`: why the message and the owner needed it but the post id and the ownership check didn't. Once I saw it's about whether a value is secret and whether it's being made public, it sort of made sense.
