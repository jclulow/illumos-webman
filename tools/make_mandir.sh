#!/bin/bash
#
# This script is a concise embodiment of HERESY BY THOUGHT
# topped off immediately by HERESY BY DEED.  There may
# be additional HERESY, but in short:
#
#  tools/make is a hacked up copy of Sun make that looks
#   for make.rules in the current directory instead of
#   in /usr/share/lib/make.
#
#  ~/illumos-gate should have the gate checked out, but
#   otherwise untouched.
#
#  this script will hopefully, in a regular SmartMachine,
#   then totally just build the manpages into proto.man.
#
# Seriously, though, probably don't run this.
#

set -o errexit
set -o pipefail

DIR=$(cd "$(dirname "$0")" && pwd)

datestamp=$(date -u +%F-%H%M%S)

export PATH=/usr/sbin:/usr/bin:$PATH
export PROTO=$DIR/../proto.man.$datestamp
export ROOT=$PROTO
export SRC=$HOME/illumos-gate/usr/src
export MAKE=$DIR/make
export MAKEFLAGS="-e"
export BUILD64="#"
export INS=/usr/sbin/install

mkdir -p "$PROTO"

for dir in "$SRC/man/"*; do
	if [[ ! -d "$dir" ]]; then
		continue
	fi

	cp "$DIR/make.rules" "$dir/make.rules"
done

(cd "$SRC/man" && cp "$DIR/make.rules" . && "$DIR/make" install MACH=i386)

#
# Manual pages from section 1ONBLD are in the tools area, separate from the
# rest of the pages.  Copy them in so that we have a single unified manual
# directory:
#
rm -rf "$PROTO/usr/share/man/man1onbld"
mkdir -p "$PROTO/usr/share/man/man1onbld"
(cd "$SRC/tools" && find . -name '*.1onbld' -exec cp {} \
   "$PROTO/usr/share/man/man1onbld" \; )

rm -f $DIR/../proto.man
ln -s "proto.man.$datestamp" "$DIR/../proto.man"
