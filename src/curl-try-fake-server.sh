#!/usr/bin/env bash

curl -X POST "http://localhost:8080/chat/completions" \
     -H "accept: application/json" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"system","content":"Hey!"}]}'
