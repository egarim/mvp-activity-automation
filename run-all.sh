#!/bin/sh
# ponytail: one portal window at a time (shared profile), so the runs go strictly one after another.
while pgrep -f "node fill-mvp-activities.js" >/dev/null; do sleep 30; done
TYPE=video DATA=new-2026/videos.json   START=0 node fill-mvp-activities.js > run-videos.log 2>&1
TYPE=video DATA=new-2026/standups.json START=0 node fill-mvp-activities.js > run-standups.log 2>&1
TYPE=oss   DATA=new-2026/oss.json      START=0 node fill-mvp-activities.js > run-oss.log 2>&1
echo ALL-DONE
