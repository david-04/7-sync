7_SYNC_JS=dist/7-sync.js
RUN=node "../$(7_SYNC_JS)"

autorun : $(7_SYNC_JS)

help : $(7_SYNC_JS)
	cd test && $(RUN) --help

version : $(7_SYNC_JS)
	cd test && $(RUN) --version

init : $(7_SYNC_JS)
	cd test && rm -f 7-sync.cfg; $(RUN) init # --config=7-sync.cfg

reconfigure : $(7_SYNC_JS)
	cd test && $(RUN) reconfigure # --config=7-sync.cfg

sync : $(7_SYNC_JS)
	rm -f test/*.log
	cd test && $(RUN) sync --password=a

$(7_SYNC_JS) : $(wildcard src/* src/*/* src/*/*/* src/*/*/*/*)
	echo Compiling....
	tsc
