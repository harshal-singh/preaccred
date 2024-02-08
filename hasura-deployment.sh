#!/usr/bin/env bash

cd backend

hasura metadata apply --endpoint $1 --admin-secret $2

hasura migrate apply --endpoint $1 --admin-secret $2 --database-name preaccred

hasura metadata reload --endpoint $1 --admin-secret $2

hasura metadata ic list --endpoint $1 --admin-secret $2

