import { JourneyRequest } from "@acko-sdui/flow-manager";
import { CustomError } from "src/utils/custom-error";
import { MO_BASE_URL, MO_GET_PROPOSAL_URL, R2D2_URL } from "./url-constants";
import { CommonUtils } from "src/utils/common-utils";
import { AxiosResponse } from "axios";
import * as _ from 'lodash';
import * as fs from 'fs';
import { PREVIOUS_POLICY_CONFIRMATION_NODE, USER_INFO_NODE, EDIT_MMV_DETAILS_NODE, CHECKOUT_DETAILS_NODE, CHECKOUT_REVIEW_NODE, VERIFY_OTP_NODE, PREVIOUS_CLAIM_CONFIRMATION_NODE, ENTER_MMV_DETAILS_NODE } from "src/constants/constants";
import { DateUtils } from "src/utils/date-utils";
import {initializeLogger} from '@acko-sdui/log-formatter';
import { logs } from "./motor-orchestrator";

let logger = initializeLogger();

export class MotorOrchestratorHelper {
    static readonly MO_BASE_URL_CONST: string = process.env.MO_BASE_URL || MO_BASE_URL; 
    static readonly PROPOSAL_CONFIG_PATH: string = 'src/configs/proposal-mapper.json'; 
    
    public static generateGetProposalRequestUrl(resolvedData: any, requestData: JourneyRequest) : string {
        let proposalEkey = "";
        if (requestData && requestData.data && requestData.data['proposal_ekey']) {
            proposalEkey = requestData.data['proposal_ekey'];
        } else {
            let proposal = resolvedData['proposal'];
            proposalEkey = proposal['ekey'];
        }
    
        let getProposalUrl = this.MO_BASE_URL_CONST + MO_GET_PROPOSAL_URL;
        getProposalUrl = getProposalUrl.replace('{proposalEkey}', proposalEkey);
        return getProposalUrl;
    }
    
    public static generateUpdateProposalRequestUrl(resolvedData: any, requestData: JourneyRequest) : string {
        let proposalEkey = "";
        if (requestData && requestData.data && requestData.data['proposal_ekey']) {
            proposalEkey = requestData.data['proposal_ekey'];
        } else {
            let proposal = resolvedData['proposal'];
            proposalEkey = proposal['ekey'];
        }
    
        let getProposalUrl = this.MO_BASE_URL_CONST + MO_GET_PROPOSAL_URL;
        getProposalUrl = getProposalUrl.replace('{proposalEkey}', proposalEkey);
        return getProposalUrl;
    }

    public static generateUpdateProposalRequestBody(resolvedData: any, requestData: JourneyRequest, requestHeaders: any) : {} {
        if (!requestData || !requestData.data) {
          logger.error(`MotorOrchestratorHelper - generateUpdateProposalRequestBody - Data incomplete for update proposal request.`);
          logger.sendR2d2("exception", {message: `${logs(resolvedData, requestData, requestHeaders)?.message} MotorOrchestratorHelper - generateUpdateProposalRequestBody - Data incomplete for making getMmvList request.`, ...logs(resolvedData, requestData, requestHeaders)?.data, error: "Data incomplete for making getMmvList request.", exception_type: "api_failed_error", exception_name: "create_proposal_data_incomplete_error"}, R2D2_URL);
          throw new CustomError("Data incomplete for update proposal request.");
        }

        requestData.data['product'] = 'car';
        requestData.data['origin'] = 'acko';
        requestData.data['is_new'] = "false";

        //node wise extra handling in updating proposal
        this.addAnyExtraUpdateParamsBasedOnNode(resolvedData, requestData, requestHeaders);
        return requestData.data;
    }

    public static filterUnchangedUpdateDataRequest(configData: any, requestData: JourneyRequest, dataSource: any): JourneyRequest {
      Object.keys(requestData?.data).forEach((key) => {
        const value = requestData?.data[key];
        const proposalValue = _.get(dataSource, configData[key]);
        if (proposalValue === value) {
          delete requestData?.data[key];
        }
      });
      return requestData;
    }

    public static addAnyExtraResolvedDataBasedOnNode(resolvedData: any, requestData: JourneyRequest, result: any) {

      if(requestData.current_node == EDIT_MMV_DETAILS_NODE && resolvedData && resolvedData['proposal']) {
        resolvedData['check_od_only'] = resolvedData['proposal']['context']['check_od_only']
      }

      if(requestData.current_node == ENTER_MMV_DETAILS_NODE && result && result['data'] && result['data']['context']) {
        resolvedData['check_od_only'] = result['data']['context']['check_od_only']
      }
     
      if((requestData.current_node == PREVIOUS_POLICY_CONFIRMATION_NODE || requestData.current_node == PREVIOUS_CLAIM_CONFIRMATION_NODE || requestData.current_node == USER_INFO_NODE) && resolvedData && resolvedData['proposal']) {
        let user_info_prefilled = false
        if(resolvedData?.proposal?.user?.name && resolvedData?.proposal?.user?.phone && (resolvedData?.proposal?.user?.pincode || resolvedData?.proposal?.suggested_attributes?.aadrila_suggestions?.suggested_pincode)){
          user_info_prefilled = true
        }
        resolvedData['user_info_prefilled'] = user_info_prefilled

        if(resolvedData['proposal']['context']){
          resolvedData['check_od_only'] = resolvedData['proposal']['context']['check_od_only']
        }
      }

      if(requestData.current_node == CHECKOUT_DETAILS_NODE && result && result['data'] && result['data']['context']) {
        resolvedData['check_od_only'] = result['data']['context']['check_od_only']
      }
      
      if(requestData.current_node == CHECKOUT_REVIEW_NODE && requestData?.data?.couponId) {
        result["data"]["delta"] = 0
      }
      
      return resolvedData;
    }

    public static readJsonFile(filePath: string): any {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }

    private static getExpiryEpochBasedOnPolicyRange(policyExpiryRange: string, isPolicyExpired: boolean) : number {
      let date = new Date();
  
      if(isPolicyExpired == true) {
        if (policyExpiryRange == "0-10") {
          date = DateUtils.subtractDays(date, 9);
        } else if (policyExpiryRange == "11-90") {
          date = DateUtils.subtractDays(date, 11);
        } else if (policyExpiryRange == "90-") {
          date = DateUtils.subtractDays(date, 91);
        } else {
          date = DateUtils.subtractDays(date, 91);
        }
      } else {
        date = DateUtils.addDays(date, 1); 
      }
      return date.getTime();
    }
    
    public static addAnyExtraUpdateParamsBasedOnNode(resolvedData: any, requestData: JourneyRequest, requestHeaders: any) {
      if((requestData.current_node == USER_INFO_NODE || requestData.current_node == PREVIOUS_POLICY_CONFIRMATION_NODE || requestData.current_node == PREVIOUS_CLAIM_CONFIRMATION_NODE) && !CommonUtils.isNullOrEmpty(resolvedData)) {
        //default to false if isCommercial is still null inside proposal
        if(resolvedData['proposal']) {
          let currentIsCommercialValue = resolvedData?.proposal?.vehicle?.is_commercial;
          if (currentIsCommercialValue == undefined) {
            logger.log(`MotorOrchestratorHelper - addAnyExtraUpdateParamsBasedOnNode - Setting isCommercial to false for proposal: ${resolvedData['proposal']['ekey']}.`);
            requestData.data['is_commercial'] = false;
          }
        }
      }

      if((requestData.current_node == EDIT_MMV_DETAILS_NODE || requestData.current_node == CHECKOUT_DETAILS_NODE) && !CommonUtils.isNullOrEmpty(resolvedData)) {
        if(resolvedData['proposal']['context']['check_od_only'] && requestData.data['previous_policy_expiry_date']) {
          requestData.data['own_damage_pped'] = requestData.data['previous_policy_expiry_date'];
        }
      }

      switch (requestData.data['previous_policy_expired']) {
        case 'yes':
          requestData.data['previous_policy_expired'] = true;
          requestData.data['previous_policy_expired_status'] = 'user';
          break;
        case 'no':
          requestData.data['previous_policy_expired'] = false;
          requestData.data['previous_policy_expired_status'] = 'user';
          break;
        case 'not-sure':
          requestData.data['previous_policy_expired'] = false;
          requestData.data['previous_policy_expired_status'] = 'assumed';
          break;
      }

      if(requestData.current_node == PREVIOUS_POLICY_CONFIRMATION_NODE && !CommonUtils.isNullOrEmpty(resolvedData)) {
        //default OD expiry date and expiry date and source if it is null inside proposal
        //and if request body is passing policy_status in request
        if(requestData.data.hasOwnProperty('previous_policy_expired') && requestData.expected_node != EDIT_MMV_DETAILS_NODE && resolvedData['proposal'] ) {
          logger.log(`MotorOrchestratorHelper - addAnyExtraUpdateParamsBasedOnNode - Setting expiryDate in proposal based on user selected range: ${resolvedData['proposal']['ekey']}.`);
          let expiryEpoch = this.getExpiryEpochBasedOnPolicyRange(requestData.data['policy_status'], requestData.data['previous_policy_expired']);
          requestData.data['previous_policy_expiry_date'] = expiryEpoch.toString();
          requestData.data['previous_policy_expiry_date_source'] = "user";
          requestData.data['own_damage_pped'] = expiryEpoch.toString();
          requestData.data['own_damage_pped_source'] = "user";
        }

        if (requestData.data['previous_policy_type'] == "third_party") {
          requestData.data['previous_policy_claim_answer'] = "not_claimed"
        }

        if(!resolvedData?.proposal?.previous_policy?.insurer_name){
          requestData.data['previous_insurer_name'] = "others";
        }
      }

      if(requestData.current_node == VERIFY_OTP_NODE){
        if(requestData.data['otp'] && requestData.data['phone']){
          delete requestData.data['otp'];
          delete requestData.data['phone'];
        }
      }

      if((requestData.current_node == ENTER_MMV_DETAILS_NODE || requestData.current_node == EDIT_MMV_DETAILS_NODE || requestData.current_node == PREVIOUS_CLAIM_CONFIRMATION_NODE)) {
        let registration_year = requestData?.data?.registration_year ?? resolvedData?.proposal?.vehicle?.["registration_year"];
        let registration_month = requestData?.data?.registration_month ?? resolvedData?.proposal?.vehicle?.["registration_month"];
        if(registration_month && registration_year){
          let isBundled = CommonUtils.isLessThanXYearsPassed(registration_year, registration_month, 2);
          let isOD = CommonUtils.isLessThanXYearsPassed(registration_year, registration_month, 3);
          if(isOD){
            requestData.data['previous_policy_type'] = 'od_only';
          }
          if(isBundled){
            requestData.data['previous_policy_type'] = 'bundled';
          }
        }
      }

      //remove fields from requestbody that are already present to prevent another update
      const configData = this.readJsonFile(this.PROPOSAL_CONFIG_PATH);
      if(
        resolvedData?.proposal?.vehicle?.registration_year 
        && resolvedData?.proposal?.vehicle?.registration_month 
        && resolvedData?.proposal?.vehicle?.registration_year == requestData?.data?.registration_year 
        && resolvedData?.proposal?.vehicle?.registration_month == requestData?.data?.registration_month
      ){
        delete requestData?.data?.registration_year;
        delete requestData?.data?.registration_month;
      }
      requestData = this.filterUnchangedUpdateDataRequest(configData, requestData, resolvedData?.proposal);
    }

    public static handleIllogicalFlow(result: AxiosResponse<any, any>, requestData: any) {
        if (result.status == 200 && (result.data.hasOwnProperty('error_code') || result.data.hasOwnProperty('error_message'))) {
            let errorMessage = result.data.hasOwnProperty('error_message') ? result.data['error_message'] : result.data['error_code'];
            logger.error('MotorOrchestratorHelper - handleIllogicalFlow - Proposal creation failed.');
            logger.sendR2d2("exception", {message: `${logs({}, requestData, {})?.message} MotorOrchestratorHelper - handleIllogicalFlow - Proposal creation failed.`, ...logs({}, requestData, {})?.data, error: "handleIllogicalFlow - Proposal creation failed.",  exception_type: "api_failed_error", exception_name: "create_proposal_illogical_flow_error"}, R2D2_URL);
            result.status = 400;
            
            result.data['errorMessage'] = errorMessage;

            throw new CustomError(errorMessage);
        }
    }

  public static convertProposalEpochsToDateFormat(result: AxiosResponse<any, any>): AxiosResponse<any, any> {
    let pathOfFieldsToBeConverted = [
        'vehicle.previous_policy.expiry_date',
        'vehicle.previous_policy.own_damage_policy_expiry_date',
        'vehicle.previous_policy.policy_expiry_date_max',
        'vehicle.previous_policy.policy_expiry_date_min',
        'vehicle.previous_policy.third_party_policy_expiry_date',
        'payment_attributes.payment_date'
    ];

    if (result.status >= 200 && result.status <= 299) {
        let dataObj = result.data;
        for (let path of pathOfFieldsToBeConverted) {
            let epochValue = _.get(dataObj, path);
            if (!CommonUtils.isNullOrEmpty(epochValue)) {
                let dateValue = CommonUtils.epochToDate(epochValue);
                let isoDate = CommonUtils.epochToDate(epochValue, true);
                _.set(dataObj, `${path}v1`, isoDate);
                _.set(dataObj, path, dateValue);
            }
        }

        result.data = dataObj;
    }
    if(result?.data?.vehicle?.previous_policy?.expiry_date){
      let expiryDate = result.data.vehicle.previous_policy.expiry_date.split(" ");
      let policyDate = `${expiryDate[0]} ${expiryDate[2]}`
      result.data.vehicle.previous_policy["expiry_datev2"] = policyDate
    }
    return result;
  }
}
