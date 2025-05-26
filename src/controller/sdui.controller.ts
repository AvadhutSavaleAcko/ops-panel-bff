import { Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { FrameworkConfiguration, JourneyRequest, Executor, ClientError, ApiError, InterfaceError } from '@acko-sdui/flow-manager';
import { ConfigSelector } from '@acko-sdui/config-selector';
import { CONTEXT_RULES_RULE_KEY, CONFIG_PATH, CONTEXT_RULES_RULE_SUB_KEY, DEFAULT_CURRENT_NODE, GROUP_NAME_FOR_FLOW_MANAGER_CONFIGS, KEY_NAME_FOR_FLOW_MANAGER_CONFIGS, LOB_NAME_FOR_CONTEXT, SERVICE_PATH_FOR_FLOW_MANAGER_CALLBACK, GROUP_NAME_FOR_UI_GENERATOR_CONFIGS, X_REQUEST_ID, INTERFACE_ERROR, GROUP_NAME_FOR_SDUI_JOURNEY_MAPPER, KEY_NAME_FOR_SDUI_JOURNEY_MAPPER } from 'src/constants/constants';
import { CommonUtils } from 'src/utils/common-utils';
import { initializeLogger } from '@acko-sdui/log-formatter';
const httpContext = require('express-http-context');
const logger = initializeLogger();

@Controller('sdui/api/v1')
export class SduiController {
  // private bffExecutor : Executor;
  private frameworkConfiguration: FrameworkConfiguration;
  private configSelector: ConfigSelector;

  constructor() {
    this.frameworkConfiguration = {
      useRuleParserForConfigSelection: false,
      // apiUrlForDynamicConfig: API_URL_FOR_DYNAMIC_CONFIG,
      apiUrlForDynamicConfig: process.env.API_URL_FOR_DYNAMIC_CONFIG,
      groupNameForUiGeneratorConfigs: GROUP_NAME_FOR_UI_GENERATOR_CONFIGS,
      servicePathForFlowManagerCallback: SERVICE_PATH_FOR_FLOW_MANAGER_CALLBACK,
      // apiUrlForContextRules: CONTEXT_RULES_API_URL,
      apiUrlForContextRules: process.env.CONTEXT_RULES_API_URL,
      ruleKeyForContextRules: CONTEXT_RULES_RULE_KEY,
      ruleSubKeyForContextRules: CONTEXT_RULES_RULE_SUB_KEY,
      lobKeyForContext: LOB_NAME_FOR_CONTEXT,
      keyNameForFlowManagerConfigs: KEY_NAME_FOR_FLOW_MANAGER_CONFIGS,
      groupNameForFlowManagerConfigs: GROUP_NAME_FOR_FLOW_MANAGER_CONFIGS,
      configsCacheValidityInMillis: 0,
      configsDeletionCronExpression: "0 * * * *",
      configPath: CONFIG_PATH,
      configSource: process.env.CONFIG_SOURCE
    };
    this.configSelector =  new ConfigSelector(
      this.frameworkConfiguration.apiUrlForDynamicConfig, 
      this.frameworkConfiguration.configsDeletionCronExpression, 
      this.frameworkConfiguration.configsCacheValidityInMillis, 
      this.frameworkConfiguration.configPath, 
      this.frameworkConfiguration.configSource
    );
    // this.bffExecutor = new Executor(frameworkConfiguration);
  }

  // using @Req() for getting full request and extracting headers from it, ideally we can use this to get body as well
  @Post('/next-node')
  @HttpCode(200)
  async identifyNextNode(
    @Req() req,
    @Res() res,
  ): Promise<any> {

    // const journeyRequest:JourneyRequest = req.body;
    const journeyRequest: JourneyRequest = { ...req.body };
    // let ress = journeyRequest?.data.ress;
    // delete journeyRequest?.data.ress;
    const requestHeaders = req.headers;
    requestHeaders['x-app-name'] = "SDUI";
    let start = new Date();
    logger.debug(`SduiController - identifyNextNode - request is:${JSON.stringify(journeyRequest)}`);

    requestHeaders[X_REQUEST_ID] = httpContext.get("requestId");
    if (this.isJourneyRequestValid(journeyRequest)) {
      try {
        if (CommonUtils.isNullOrEmpty(journeyRequest.current_node)) {
          logger.warn(`current node in not pressent in request, hence falling back to unknown.`);
          journeyRequest.current_node = DEFAULT_CURRENT_NODE;
        }
        // let response = await this.bffExecutor.execute(
        //   journeyRequest,
        //   requestHeaders
        // );
        await this.getGroupAndKeyNameBasedOnJourney(this.configSelector, this.frameworkConfiguration, journeyRequest?.journey)
        let response = await new Executor(this.frameworkConfiguration).execute(
          journeyRequest,
          requestHeaders
        );
        // setting custom cookie :)
        res.cookie("isSdui", "true", {
          httpOnly: true,
          maxAge: 10 * 60 * 1000
        });
        logger.debug(`X-Request-Id: ${requestHeaders[X_REQUEST_ID]}, headers: ${JSON.stringify(requestHeaders)}, request is:${JSON.stringify(journeyRequest)}, next node response: ${JSON.stringify(response)}`);
        let end = new Date().getTime() - start.getTime();
        let edata = {
          "location": "identifyNextNode",
          "duration": end
        }
        logger.sendR2d2("next-node", edata, "https://www.acko.com/api/r2d2/");
        return res.send(response);
      } catch (error) {
        if (error instanceof ApiError) {
          logger.error(`API Error: " ${error?.message} ${error?.data}`);
          throw new HttpException({message: `API Error: ${error?.message}`, data: error?.data}, 400);
        }

        if (error instanceof InterfaceError) {
          logger.error(`Interface Error: " ${error?.message} ${error?.data}`);
          throw new HttpException({
              message: `${error?.message}`,
              data: {
                code: INTERFACE_ERROR,
                error_details: {
                  message: error?.data,
                  action: "same_node",
                  method: "toast"
                },
              },
            }, 500);
        }

        if (error instanceof ClientError) {
          logger.error(`Downstream API Error: " ${error['message']}`);
          throw new HttpException("Downstream API Error: " + error['message'], HttpStatus.BAD_REQUEST);
        } else {
          let errorMessage = error?.response?.data || error['message'];
          logger.error(`Could not evaluate next node: " ${JSON.stringify(errorMessage)}`);
          throw new HttpException("Could not evaluate next node: " + error['message'], HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }
    }

    logger.error(`Journey Request is not valid.`);
    throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
  }

  //TODO replace this with some validator library
  private isJourneyRequestValid(journeyRequest: JourneyRequest): boolean {
    if (CommonUtils.isNullOrEmpty(journeyRequest.journey)
      || CommonUtils.isNullOrEmpty(journeyRequest.data)) {
      return false;
    }
    return true;
  }

  private async getGroupAndKeyNameBasedOnJourney(configSelector, frameworkConfiguration: FrameworkConfiguration, journey): Promise<void> {
    // Fetch configuration for the specific journey
    const config = await configSelector.getConfigByGroupAndKeyName(GROUP_NAME_FOR_SDUI_JOURNEY_MAPPER, KEY_NAME_FOR_SDUI_JOURNEY_MAPPER);
    const journeyConfig = config[journey];  // Store the config for the specific journey
  
    if (journeyConfig) {
      const { groupNameForUiGeneratorConfigs, keyNameForFlowManagerConfigs, groupNameForFlowManagerConfigs } = journeyConfig;
      
      // Assign the values to frameworkConfiguration
      frameworkConfiguration.groupNameForUiGeneratorConfigs = groupNameForUiGeneratorConfigs;
      frameworkConfiguration.keyNameForFlowManagerConfigs = keyNameForFlowManagerConfigs;
      frameworkConfiguration.groupNameForFlowManagerConfigs = groupNameForFlowManagerConfigs;
    }
  }

  @Post('/ops-panel/next-node')
  @HttpCode(200)
  async identifyNextNodeForOpsPanel(
    @Req() req,
    @Res() res,
  ): Promise<any> {
     try {
      const journeyRequest: JourneyRequest = { ...req.body };
      console.log("journeyRequest", journeyRequest);
      return res.send(journeyRequest);
     }catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API Error: " ${error?.message} ${error?.data}`);
        throw new HttpException({message: `API Error: ${error?.message}`, data: error?.data}, 400);
      }
      
      if (error instanceof InterfaceError) {
        logger.error(`Interface Error: " ${error?.message} ${error?.data}`);
        throw new HttpException({
            message: `${error?.message}`,
            data: {
              code: INTERFACE_ERROR,
              error_details: {
                message: error?.data,
                action: "same_node",
                method: "toast"
              },
            },
          }, 500);
      }

      if (error instanceof ClientError) {
        logger.error(`Downstream API Error: " ${error['message']}`);
        throw new HttpException("Downstream API Error: " + error['message'], HttpStatus.BAD_REQUEST);
      } else {
        let errorMessage = error?.response?.data || error['message'];
        logger.error(`Could not evaluate next node: " ${JSON.stringify(errorMessage)}`);
        throw new HttpException("Could not evaluate next node: " + error['message'], HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }
}
