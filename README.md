# EastAgile Sentry-Alert and 0l-validator-health notifier

A Node project that tracks the health of 0L validator nodes/Sentry project error alerts and publishes notifications to Slack.

## Health Checks

1.  Node Offline
2.  Not in Sync
3.  Not in validator set
4.  Not running
5.  Votes in epoch unchanged in the last 5 min
6.  Proofs in epoch unchanged - If the proofs submitted by a validator is less than 8 and no new proofs have been submitted in the last 3 hours.

![11d9f8d52f78.png]](https://user-images.githubusercontent.com/36015640/148246687-a2193d44-da74-47de-aa74-11d9f8d52f78.png)

## Adding monitoring for your validator node

To get monitoring add a new file called [credential.toml](./credential.toml)

    # CONFIG NEEDED FOR SENTRY ALERT
    PORT = 8000
    DEFAULT_WEBHOOK = "https://hooks.slack.com/services/.../.../"

    # CONFIG FOR 0L VALIDATOR HEALTH
    VALIDATOR_WEBHOOK = "https://hooks.slack.com/services/.../.../"
    FULL_NODE_IP = "xxx.xxx.xxx.xxx"
    VALIDATORS = ["xxx.xxx.xxx.xxx"]
    ERROR_TYPES = ["ALL"]
    INTERVAL = 36000 # 1 hour
    SENDGRID_API_KEY = ""
    SENDGRID_EMAIL_FROM = ""
    SENDGRID_EMAIL_TO = ""
    SENDGRID_EMAIL_CC = ""
    
- WEBHOOKS: Slack webhooks.
- FULL_NODE_IP: IP of a 0L network full node
- VALIDATORS: IP addresses of your validator nodes. Ensure the web monitor is running and port 3030 is open
- Special case for Sentry you need to set up a new internal integration, set new alert rules to send webhook, set Alert Callback URLs to this server. Default is [localhost:8000/sentry_call_back](localhost:8000/sentry_call_back)
- SENDGRID_*: For sending notification via email. SENDGRID_EMAIL_FROM is associated with SENDGRID_API_KEY.

### How to use

If you'd like to run the monitor yourself:

    clone repo
    npm install
    add credential.toml
    # FOR SENTRY ALERT
    node index.js
    # FOR 0L HEALTH
    node validator.js
