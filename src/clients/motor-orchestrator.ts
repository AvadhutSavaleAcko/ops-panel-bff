import axios from "axios";
import * as _ from 'lodash';
import { JourneyRequest, ApiError } from "@acko-sdui/flow-manager";
import { MotorOrchestratorHelper } from "./motor-orchestrator-helper";
import { R2D2_URL } from "./url-constants"
import { APP_NAME } from "src/constants/constants";
import { initializeLogger } from '@acko-sdui/log-formatter';
const util = require('util');

axios.defaults.headers.common = {
    'x-app-name': APP_NAME,
    'source': APP_NAME
};

let logger = initializeLogger();

async function getProposalFromMO(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {

    //TODO validation checks should be performed and client should be given correct error message.
    let requestUrl = MotorOrchestratorHelper.generateGetProposalRequestUrl(resolvedData, requestData);
    logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - getProposalFromMO - request requestUrl: ${requestUrl}`);
    //make a GET call
    let result = await axios.get(requestUrl);
    resolvedData['mo_proposal'] = result?.data;
    return result;
}

async function getProposal(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {
    let result = _.cloneDeep(await getProposalFromMO(resolvedData, requestData, requestHeaders));
    result.data.vehicle["vehicle_type"] = (result?.data?.vehicle?.is_commercial) ? "Commercial" : "Private";
    if (result?.data?.coupon?.code && !result?.data?.coupon?.coupon_display_name) {
        result["data"]["coupon"]["coupon_display_name"] = result?.data?.coupon?.code;
    }
    result = MotorOrchestratorHelper.convertProposalEpochsToDateFormat(result);
    logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - getProposal - response: ${util.inspect(result)}`);
    resolvedData['oldPremium'] = resolvedData?.oldPremium ? resolvedData?.oldPremium : result?.data?.policy_attributes?.plan?.net_premium;
    return result;
}


async function updateProposal(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {
    let requestUrl = MotorOrchestratorHelper.generateUpdateProposalRequestUrl(resolvedData, requestData);
    let selectedAddons = requestData?.data?.selected_addons;
    delete requestData?.data?.selected_addons;
    let requestBody = MotorOrchestratorHelper.generateUpdateProposalRequestBody(resolvedData, requestData, requestHeaders);
    logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - updateProposal - request requestUrl: ${requestUrl}, requestBody: ${util.inspect(requestBody)}`);
    //make a PUT call
    let result;
    try {
        result = await axios.put(requestUrl, requestBody, {
            headers: { 'Cookie': requestHeaders?.cookie }
        });
        result = MotorOrchestratorHelper.convertProposalEpochsToDateFormat(result);
        if (result?.data?.coupon?.code && !result?.data?.coupon?.coupon_display_name) {
            result["data"]["coupon"]["coupon_display_name"] = result?.data?.coupon?.code;
        }
        resolvedData = MotorOrchestratorHelper.addAnyExtraResolvedDataBasedOnNode(resolvedData, requestData, result)
    }
    catch (error) {
        result = { 'data': error['response']['data'] };
        logger.error(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - updateProposal :: error in updateProposal API, error: ${error}`);
        logger.sendR2d2("exception", { message: `${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - updateProposal :: error in updateProposal API - error`, ...logs(resolvedData, requestData, requestHeaders)?.data, error: error, exception_type: "api_failed_error", exception_name: "update_proposal_error" }, R2D2_URL);
        // for redirection to plans_ineligible_node when is_commercial true in update proposal API
        if (error['response']['data']['error_message'] == 'We only support private vehicles today...!') {
            result['data']['error_code'] = "COMMERCIAL_VEHICLE";
            result['data']['errorMessage'] = error['response']['data']['error_message']
            resolvedData['proposal'] = { 'errorMessage': error['response']['data']['error_message'] }
        }
        else { }
        result['status'] = error?.status;
    }

    logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - updateProposal - response: ${util.inspect(result)}`);
    resolvedData['mo_proposal'] = _.cloneDeep(result?.data);
    resolvedData['proposal'] = _.cloneDeep(result?.data);
    requestData["data"]["selected_addons"] = selectedAddons;
    return result;
}

async function errorHandling(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {

    const configData = MotorOrchestratorHelper.readJsonFile('src/configs/error.json');
    let errorData = [];

    Object.entries(resolvedData).forEach(([key, value]) => {
        if (value && value["error_code"] && configData[value["error_code"]]) {
            errorData.push({ code: value["error_code"], error_details: configData[value["error_code"]] });
        }
    });

    if (errorData.length > 0) {
        errorData.sort((item1, item2) => { return item1.priority - item2.priority; });
        if (errorData[0]?.error_details?.action == "same_node" || errorData[0]?.action == "same_node") {
            throw new ApiError("ApiError", errorData[0]);
        }
        logger.error(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - errorHandling : ${errorData[0]} --API FAILURE--`);
        logger.sendR2d2("exception", { message: `${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - errorHandling :: Some error in errorHandling API, error`, ...logs(resolvedData, requestData, requestHeaders)?.data, error: errorData, exception_type: "api_failed_error", exception_name: "error_handling_error" }, R2D2_URL);
        return { data: errorData[0], status: 200 };
    }
    logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - errorhandling --ALL API SUCCESS--`);
    return { data: null, status: 200 };
}

export function logs(resolvedData: any, requestData: any, requestHeaders: any): any {

    const proposalId = resolvedData?.proposal?.ekey ?? requestData?.data?.proposal_ekey;
    const proposalLog = proposalId ? `proposalId: ${proposalId} ` : "";

    const registrationNumber = resolvedData?.proposal?.vehicle?.registration_number;
    const registrationNumberLog = registrationNumber ? `registrationNumber: ${registrationNumber}` : "";

    const trackerId = requestHeaders["x-tracker-id"] ? `trackerId: ${requestHeaders["x-tracker-id"]} ` : "";

    const currentNode = requestData?.current_node ? `currentNode: ${requestData?.current_node}` : "";

    let data = { proposal_id: proposalId, response: requestData, tracker_id: requestHeaders["x-tracker-id"], phone: resolvedData?.proposal?.user?.phone, registration_number: resolvedData?.proposal?.vehicle?.registration_number }

    return { message: `${trackerId}${proposalLog}${registrationNumberLog}${currentNode}`, data: data };
}
async function getProposalByRegNo(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {
    let regNo = requestData?.data?.registration_number;
    if(requestData?.data?.registration_number == null || requestData?.data?.registration_number == undefined)   return {data: []};
    try {
        console.log("Received requestData:", JSON.stringify(requestData, null, 2)); 
        const requestUrl = `https://motor-orchestrator-uat.internal.ackodev.com/motororchestrator/internal/api/advisor/proposal_list/${regNo}`;

        logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - getProposalFromMO - request requestUrl: ${requestUrl}`);
        
        const result = await axios.get(requestUrl, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        return result;
    } catch (error) {
        logger.error("Error fetching proposal from Motor Orchestrator:", error);
        throw new Error("Failed to fetch proposal from Motor Orchestrator.");
    }
}

async function getProposalByPaymentId(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {
    let payment_id = requestData?.data?.payment_id;
    if(payment_id == null || payment_id == undefined)   return {data: []};
    try {
        console.log("Received requestData:", JSON.stringify(requestData, null, 2)); 
        const requestUrl = `https://motor-orchestrator-uat.internal.ackodev.com/motororchestrator/internal/api/advisor/proposal/${payment_id}`;

        logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - getProposalFromMO - request requestUrl: ${requestUrl}`);
        
        const result = await axios.get(requestUrl, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        return result;
    } catch (error) {
        logger.error("Error fetching proposal from Motor Orchestrator:", error);
        throw new Error("Failed to fetch proposal from Motor Orchestrator.");
    }
}

async function getProposalByProposalEkey(resolvedData: any, requestData: JourneyRequest, requestHeaders: any): Promise<any> {
    let  proposal_ekey = requestData?.data?.proposal_ekey;
    if(proposal_ekey == null || proposal_ekey == undefined)   return {data: []};
    try {
        console.log("Received requestData:", JSON.stringify(requestData, null, 2)); 
        const requestUrl = `https://motor-orchestrator-uat.internal.ackodev.com/motororchestrator/internal/api/v1/proposals/${proposal_ekey}`;

        logger.log(`${logs(resolvedData, requestData, requestHeaders)?.message} motor-orchestrator - getProposalFromMO - request requestUrl: ${requestUrl}`);
        
        const result = await axios.get(requestUrl, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        return result;
    } catch (error) {
        logger.error("Error fetching proposal from Motor Orchestrator:", error);
        throw new Error("Failed to fetch proposal from Motor Orchestrator.");
    }
}

module.exports = {
    getProposal,
    updateProposal,
    getProposalByRegNo,
    getProposalByPaymentId,
    getProposalByProposalEkey
};
