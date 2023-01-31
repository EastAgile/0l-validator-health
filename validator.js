const { IncomingWebhook } = require("@slack/webhook");
const eventSource = require('eventsource');
const toml = require('toml');
const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail')

const errorChecker = require("./errorChecker.js")

const CONFIG_ENV = process.env
const CONFIG_TOML = 'credential.toml'
const validatorErrorMap = new Map()

let parsed = [];
let CONFIG = [];
if (!fs.existsSync(CONFIG_TOML)) {
    console.log("File not found, skip config file");
    CONFIG["VALIDATORS"] = CONFIG_ENV.VALIDATORS_DATA.split(" ");
    CONFIG["ERROR_TYPES"] = CONFIG_ENV.ERROR_TYPES_DATA.split(" ");
    CONFIG = { ...CONFIG, ...CONFIG_ENV }
} else {
    parsed = toml.parse(fs.readFileSync(CONFIG_TOML, 'utf8'));
    CONFIG = { ...parsed }
}
sgMail.setApiKey(CONFIG.SENDGRID_API_KEY)

function getValidatorStats() {
    for (let validator of CONFIG.VALIDATORS) {
        let uri = `http://${validator}:3030/vitals`

        try {
            const sse = new eventSource(uri)
            sse.onmessage = async (msg) => {
                sse.close()
                let response = JSON.parse(msg.data)
                let errors = await errorChecker.checkForErrors(validator, CONFIG, response)
                //validator = response.account_view.address
                calNotification(validator, errors)
            }
            sse.onerror = (err) => {
                sse.close()
                calNotification(validator, ['OFFLINE'])
                console.log(`Error from validator: ${err}`)
            }
        } catch (err) {
            calNotification(validator, ['OFFLINE'])
            console.log(`Error from eventSource: ${err}`)
        }
    }
}

function calNotification(validator, newErrors) {
    let errorKey = validator
    //console.log(newErrors)
    const hasErrors = validatorErrorMap.has(errorKey);
    if (newErrors.length === 0 && hasErrors) {
        sendNotification(validator, { value: "" })
        validatorErrorMap.delete(errorKey)
    }
    else if (newErrors.length > 0 && !hasErrors) {
        sendNotification(validator, { value: newErrors.join("\n") })
        validatorErrorMap.set(errorKey, newErrors)
    }
    else if (newErrors.length > 0 && hasErrors) {
        let errorsCleared = validatorErrorMap.get(errorKey).filter(error => !newErrors.includes(error))
        if (errorsCleared.length > 0) {
            sendNotification(validator, { value: newErrors.join("\n") })
        }
        validatorErrorMap.set(errorKey, newErrors)
    }
}

function sendNotification(ip, err) {
    if (CONFIG.SENDGRID_API_KEY && err.value.includes("not in validator set")) {
        sendEmail(JSON.stringify(err))
    }
    if (!CONFIG.VALIDATOR_WEBHOOK) {
        return "no webhook"
    }
    // Initialize
    const slackWebhook = new IncomingWebhook(CONFIG.VALIDATOR_WEBHOOK);

    let alert = [
        {
            "mrkdwn_in": ["text"],
            "color": "#FF7434",
            "pretext": "",
            "author_name": "0L validator health",
            "author_link": "",
            "author_icon": "",
            "title": "",
            "title_link": "",
            "text": "",
            "fields": [
                {
                    "title": ip,
                    "value": `\`\`\`${JSON.stringify(err)}\`\`\``,
                    "short": false
                }
            ],
            "thumb_url": "",
            "footer": "",
            "footer_icon": "",
            "ts": new Date().getTime()
        }
    ];

    //Send the notification
    (async () => {
        await slackWebhook.send({
            //text: tableMdString
            text: "",
            "attachments": alert
        });
    })();
}

function sendEmail(err) {
    if (err.length == 0) {
        console.log("Validator is functional")
        return
    }
    let email_content = fs.readFileSync(path.join(__dirname, "email/validator_error.txt"))
    let html_email_content = fs.readFileSync(path.join(__dirname, "email/validator_error.html"))

    const message = {
        to: CONFIG.SENDGRID_EMAIL_TO,
        cc: CONFIG.SENDGRID_EMAIL_CC,
        from: CONFIG.SENDGRID_EMAIL_FROM,
        subject: '[0L Validator Health] New error message',
        text: eval("`" + email_content + "`"),
        html: eval("`" + html_email_content + "`"),
    }

    console.log("Sending email")
    sgMail
        .send(message)
        .then((response) => {
            console.log(`Email sent with response code ${response[0].statusCode}`)
        })
        .catch((error) => {
            console.error(error)
        })
}

console.log('Starting 0l validator health ...')
setInterval(getValidatorStats, CONFIG.INTERVAL);
