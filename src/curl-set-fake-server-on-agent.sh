#!/usr/bin/env bash

AGENT_ID="my-agent-id-1234567890"
API_KEY="myApiKey"
USER_ID="myUserId"
CUSTOM_LLM_URL="https://example1-exam-ple1-exam-ple1example1-ex-ample1example.riker.replit.dev/"
CUSTOM_LLM_API_KEY="my-llm-api-key"

curl -X PATCH "https://api.play.ai/api/v1/agents/${AGENT_ID}" \
     -H "Authorization: Bearer ${API_KEY}" \
     -H "X-User-Id: ${USER_ID}" \
     -H "Content-Type: application/json" \
     -d "{
           \"llm\": {
             \"baseURL\": \"${CUSTOM_LLM_URL}\",
             \"apiKey\": \"${CUSTOM_LLM_API_KEY}\"
           }
         }"
