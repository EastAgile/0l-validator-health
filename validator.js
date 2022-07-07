const {IncomingWebhook} = require("@slack/webhook");
const  eventSource = require('eventsource');
const errorChecker = require("./errorChecker.js")
const toml = require('toml');
const CONFIG_ENV = process.env
const CONFIG_TOML = 'credential.toml'
const fs = require('fs');
const validatorErrorMap = new Map()

let parsed = [];
let CONFIG = [];
if(!fs.existsSync(CONFIG_TOML)) {
    console.log("File not found, skip config file");
    CONFIG["VALIDATORS"] = CONFIG_ENV.VALIDATORS_DATA.split(" ");
    CONFIG["ERROR_TYPES"] = CONFIG_ENV.ERROR_TYPES_DATA.split(" ");
    CONFIG = {...CONFIG, ...CONFIG_ENV}
} else {
    parsed = toml.parse(fs.readFileSync(CONFIG_TOML, 'utf8'));
    CONFIG = { ...parsed}
}

function getValidatorStats() {
    for(let validator of CONFIG.VALIDATORS){
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
                calNotification(validator,['OFFLINE'])
            }
        } catch (err) {
            console.log('error')
            calNotification(validator,['OFFLINE'])
        }
    }

}

console.log('Starting 0l validator health ...')
//getValidatorStats()
setInterval(getValidatorStats, CONFIG.INTERVAL);

function calNotification(validator, newErrors){
    let errorKey = validator
    //console.log(newErrors)
    const hasErrors = validatorErrorMap.has(errorKey);
    if( newErrors.length === 0 && hasErrors){
        sendNotification(validator, [])
        validatorErrorMap.delete(errorKey)
    }
    else if(newErrors.length > 0 && !hasErrors ){
        sendNotification(validator, {value: newErrors.join("\n")})
        validatorErrorMap.set(errorKey, newErrors)
    }
    else if(newErrors.length > 0 && hasErrors){
        let errorsCleared = validatorErrorMap.get(errorKey).filter(error => !newErrors.includes(error))
        if(errorsCleared.length >0){
            sendNotification(validator, {value: newErrors.join("\n")})
        }
        validatorErrorMap.set(errorKey, newErrors)
    }
}

function sendNotification(ip, err) {
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

