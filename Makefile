7_SYNC_JS=dist/7-sync.js
RUN=node "../$(7_SYNC_JS)"

autorun : sync

init : $(7_SYNC_JS)
	cd test && rm -f 7-sync.cfg; $(RUN) init # --config=7-sync.cfg

reconfigure : $(7_SYNC_JS)
	cd test && $(RUN) reconfigure # --config=7-sync.cfg

sync : $(7_SYNC_JS)
    ifneq "$(wildcard test/*.log)" ""
	rm test/*.log
    endif
	cd test && $(RUN) sync --password=a --7-zip=7z  # --config=7-sync.cfg

help : $(7_SYNC_JS)
	cd test && $(RUN) --help

$(7_SYNC_JS) : $(wildcard src/* src/*/* src/*/*/* src/*/*/*/*)
	echo Compiling....
	tsc
