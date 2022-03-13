7_SYNC_JS=dist/7-sync.js
RUN=node "$(7_SYNC_JS)"

autorun : sync

init : $(7_SYNC_JS)
	rm -f 7-sync.cfg; $(RUN) init # --config=7-sync.cfg

reconfigure : $(7_SYNC_JS)
	$(RUN) reconfigure # --config=7-sync.cfg

sync : $(7_SYNC_JS)
	$(RUN) sync # --config=7-sync.cfg

help : $(7_SYNC_JS)
	$(RUN) --help

$(7_SYNC_JS) : $(wildcard src/* src/*/* src/*/*/* src/*/*/*/*)
	echo Compiling....
	tsc
