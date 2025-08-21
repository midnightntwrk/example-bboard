# Bulletin board contract and DApp

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.23.0-1abc9c.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://shields.io/)

This example implements a simple one-item bulletin board. It allows
users to post a single message at a time, and only the user who posted
the message can take it down and make the board vacant again.

The full description of the bulletin board scenario, as well as a
detailed discussion of the code, can be found in
[part 3](https://docs.midnight.network/develop/tutorial/creating/)
of the Midnight developer tutorial.

The `api` directory contains different methods, classes and types required to run the bboard CLI and the bboard UI.

The `contract` directory contains the Compact contract and its utilities.

The `bboard-cli` directory contains the code required to run the bboard dapp as a CLI app.

The `bboard-ui` directory contains the code needed to build the interface and interact with it in the browser.
The interface allows the user to deploy a new bboard contract, post a new message and take it down.

## How to use the CLI

Note: if installing via npm, you need to pass `--legacy-peer-deps` because of the more modern use of vite.

1. Install the node modules in the root
1. Install the node modules in `api`
1. Install the node modules in `contract`, compile the contract with `npm run compact`, and then the typescript with `npm run build`
1. Install the node modules in `bboard-cli`, build it and run `npm run testnet-remote` to launch the app

## How to use the user interface

1. Install the node modules in the root
1. Install the node modules in `api`
1. Install the node modules in `contract` and compile it
1. Install the node modules in `bboard-ui`
1. Run `npm run build:start` to build the project and run a local server
