# Bulletin board contract and DApp

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.23.0-1abc9c.svg)](https://shields.io/)  
[![Generic badge](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://shields.io/)

This example implements a simple one-item bulletin board. It allows
users to post a single message at a time, and only the user who posted
the message can take it down and make the board vacant again.

The full description of the bulletin board scenario, as well as a
detailed discussion of the code, can be found in part 3 of the
Midnight developer tutorial.

The `api` directory contains different methods, classes and types required to run the bboard CLI and the bboard UI.

The `contract` directory contains the Compact contract and its utilities.

The `bboard-cli` directory contains the code required to run the bboard dapp as a CLI app.

The `bboard-ui` directory contains the code needed to build the interface and interact with it in the browser.
The interface allows the user to deploy a new bboard contract, post a new message and take it down.

## How to use the CLI

1- Install the node modules in the root
2- Install the node modules in `api`
3- Install the node modules in `contract` and compile it
4- Install the node modules in `bboard-cli`, build it and run `npm run testnet-remote` to launch the app

## How to use the user interface

1- Install the node modules in the root
2- Install the node modules in `api`
3- Install the node modules in `contract` and compile it
4- Install the node modules in `bboard-ui`
5- Run `npm run build:start` to build the project and run a local server

### LICENSE

Apache 2.0.

### SECURITY.md

Provides a brief description of the Midnight Foundation's security policy and how to properly disclose security issues.

### SUPPORT.md

Outlines the ways users can get help or support for a Midnight project.

### CONTRIBUTING.md

Provides guidelines for how people can contribute to the Midnight project.

### CODEOWNERS

Defines repository ownership rules.

### ISSUE_TEMPLATE

Provides templates for reporting various types of issues, such as: bug report, documentation improvement and feature request.

### PULL_REQUEST_TEMPLATE

Provides a template for a pull request.

### CLA Assistant

The Midnight Foundation appreciates contributions, and like many other open source projects asks contiributors to sign a contributor
License Agreement before accepting contributions. We use CLA assistant (https://github.com/cla-assistant/cla-assistant) to streamlines the CLA
signing process, enabling contributors to sign our CLAs directly within a GitHub pull request.

### Dependabot

The Midnight Foundation uses GitHub Dependabot feature to keep our projects dependencies up-to-date and address potential security vulnerabilities.

### Checkmarx

The Midnight Foundation uses Checkmarx for application security (AppSec) to identify and fix security vulnerabilities.
All repositories are scanned with Checkmarx's suite of tools including: Static Application Security Testing (SAST), Infrastructure as Code (IaC), Software Composition Analysis (SCA), API Security, Container Security and Supply Chain Scans (SCS).

### Unito

Facilitates two-way data synchronization, automated workflows and streamline processes between: Jira, GitHub issues and Github project Kanban board.
