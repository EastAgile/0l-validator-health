const addressVoteMap = new Map();

const proofsInEpochMap = new Map()
const THREE_HRS_IN_MS = 10800000

async function checkForErrors(validator, CONFIG, response) {
    let errors = []
    const notiFyForArray = CONFIG.ERROR_TYPES;
    let validatorIpAddress = validator.ipAddress
    if ((notiFyForArray.includes('NOT_IN_SYNC') || notiFyForArray.includes('ALL')) && !response.items.is_synced) {
        errors.push('not in sync');
    }
    if ((notiFyForArray.includes('NOT_IN_VALIDATOR_SET') || notiFyForArray.includes('ALL')) && !response.items.validator_set) {
        errors.push('not in validator set');
    }
    if ((notiFyForArray.includes('NOT_RUNNING') || notiFyForArray.includes('ALL')) && !response.items.node_running) {
        errors.push('not running');
    }
    if(notiFyForArray.includes('VOTES_IN_EPOCH_UNCHANGED') || notiFyForArray.includes('ALL')){
        let validatorAddress = response.account_view.address
        let voteKey = validatorAddress + validator.description
        for(val of response.chain_view.validator_view){
            if(val.account_address == validatorAddress.toUpperCase()){
                let voteCount = val.vote_count_in_epoch
                let mapVal = addressVoteMap.get(voteKey)
                if(addressVoteMap.has(voteKey) && 
                        mapVal.votes === voteCount){
                    errors.push(`votes in epoch: ${voteCount}, unchanged in > 5 min`)                }
                else {
                    addressVoteMap.set(voteKey, {votes: voteCount, timestamp: Date.now()})
                }
            }
        }
    }

    if(notiFyForArray.includes('PROOFS_IN_EPOCH_UNCHANGED') || notiFyForArray.includes('ALL')){
        let proofsInEpoch = await getProofsInEpoch(response.account_view.address, CONFIG)
        let proofKey = validatorIpAddress + validator.description
        if(proofsInEpochMap.has(proofKey)){
            let oldProofs = proofsInEpochMap.get(proofKey).proofs
            let lastProofChangeTimestamp = proofsInEpochMap.get(proofKey).timestamp
            if(oldProofs < 8 && oldProofs == proofsInEpoch &&  
                Date.now() - lastProofChangeTimestamp > THREE_HRS_IN_MS ){
                errors.push(`proofs in epoch: ${proofsInEpoch}. No new proofs in last 3 hours`)
            }
            if(oldProofs != proofsInEpoch){
                proofsInEpochMap.set(proofKey, {proofs : proofsInEpoch, timestamp: Date.now() })
            }
        }
        else{
            proofsInEpochMap.set(proofKey, {proofs : proofsInEpoch, timestamp: Date.now() })
        }   
        
    }
    return errors
}



async function getProofsInEpoch(account, CONFIG){
    try{
    const response = await axios.post(`http://${CONFIG.FULl_NODE_IP}:8080`,
            {"jsonrpc": "2.0", "id": 1, "method": "get_tower_state_view", "params": [account] },
            {timeout: 500})
            return response.data.result.actual_count_proofs_in_epoch
    }
    catch(error){
        console.log(`Can't connect to ${CONFIG.FULL_NODE_IP}`)
        return Number.MAX_VALUE
    }
}

module.exports = {checkForErrors}
