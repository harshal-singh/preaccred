#!/usr/bin/env bash

# this function is called when Ctrl-C is sent
function stop_container () {
  echo "-----------------------------" 
  echo "    Stopping container..."
  echo "-----------------------------" 
  docker-compose down
  exit 0
}

# call function
trap "stop_container" 2

cd hasura

docker-compose up --build -d

echo ""

SECONDS=0
until curl -s -f -o /dev/null "http://localhost:8080/healthz"
do
echo " => Waiting for hasura to start (${SECONDS}s)"
sleep 1
done

echo ""

hasura console

if [[ $? > 0 ]]; then
  echo "-----------------------------"
  echo "    Error :("
  echo "-----------------------------"
  echo "    While starting docker"
  echo "    Stopping container..."
  echo "-----------------------------"
  docker-compose down
  exit 1;
fi
