# `bitport`

A program to export all of your bitwarden data, including attachments!

A fix for the community issue: https://community.bitwarden.com/t/encrypted-export/235. Hopefully Bitwarden provide an official implementation, but I couldn't live without backing up my vault, so I made this.

There is another project called [`portwarden`](https://github.com/vwxyzjn/portwarden), but that was quite complex and also had some usability things I didn't really like. Also, I'm handling my Bitwarden vault - should I really be using someone else's code? :sweat_smile:

## Usage

You'll need a recent version of `nodejs` to run this.

```bash
# clone the repository
$ git clone https://github.com/acheronfail/bitport.git
$ cd bitport
# install dependencies
$ yarn
# check help
$ yarn tsx --help

# run bitport
$ yarn tsx index.ts path/to/vault/export # ...and any extra options here (see help output)
```

**Warning: this exports all your Bitwarden data _in plain text!_ That means it's unencrypted!**.
When you use this to make a backup, you should obviously encrypt your backup with the same or stronger encryption than what Bitwarden itself uses! This is out of scope for this tool, which just exports the Bitwarden data.
