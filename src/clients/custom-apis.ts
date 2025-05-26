import axios from "axios";
import * as _ from "lodash";
import { JourneyRequest, ApiError } from "@acko-sdui/flow-manager";
import { APP_NAME } from "src/constants/constants";
import { initializeLogger } from "@acko-sdui/log-formatter";
import * as fs from "fs";
import * as path from "path";
import { flattenObject } from "./custom-apis-helper";
axios.defaults.headers.common = {
  "x-app-name": APP_NAME,
  source: APP_NAME,
};

let logger = initializeLogger();

async function getTabNameList(
  resolvedData: any,
  requestData: JourneyRequest,
  requestHeaders: any
): Promise<any> {
  try {
    const sampleJsonPath = path.join(
      process.cwd(),
      "src/configs/defaultCache/sample.json"
    );

    if (!fs.existsSync(sampleJsonPath)) {
      logger.debug("sample.json configuration file not found");
      return { data: [] };
    }

    try {
      const sampleConfig = JSON.parse(fs.readFileSync(sampleJsonPath, "utf8"));
      
      const tabNames = Object.keys(sampleConfig).map(tabName => ({
        tab_name: tabName,
        row: sampleConfig[tabName].row || 1
      }));

      return {
        data: tabNames,
      };
      
    } catch (readError) {
      logger.error(`Error reading sample.json: ${readError.message}`);
      return { data: [] };
    }

  } catch (error) {
    logger.error(`Error in getTabNameList: ${error.message}`);
    throw new Error("Failed to fetch tab name list");
  }
}

async function getTabInfo(
  resolvedData: any,
  requestData: JourneyRequest
): Promise<any> {
  try {
    if (!requestData?.data) {
      logger.debug("No request data found");
      return { data: [] };
    }

    return {
      data: {
        tab_name: requestData?.data?.tab_name,
        row: requestData?.data?.row,
      },
    };
  } catch (error) {
    logger.error(`Error in getTabInfo: ${error.message}`);
    throw new Error("Failed to get tab information");
  }
}

async function resolveAction(
  resolvedData: any,
  requestData: JourneyRequest
): Promise<any> {}
interface TabConfig {
  tab_name: string;
  row: number;
  list_data: any;
}
interface TabConfigWrapper {
  data: TabConfig;
}

async function dataForDashboard(
  resolvedData: any,
  requestData: JourneyRequest
): Promise<any> {
  try {
    const sampleJsonPath = path.join(
      process.cwd(),
      "src/configs/defaultCache/sample.json"
    );
    const formatToSavePath = path.join(
      process.cwd(),
      "src/configs/defaultCache/formatTosave.json"
    );

    if (!fs.existsSync(sampleJsonPath) || !fs.existsSync(formatToSavePath)) {
      throw new Error("Required configuration files not found");
    }

    const sampleConfig = JSON.parse(fs.readFileSync(sampleJsonPath, "utf8"));
    const formatConfig = JSON.parse(fs.readFileSync(formatToSavePath, "utf8"));

    const tab_list = await Promise.all(
      Object.entries(sampleConfig).map(async ([key, value]: [string, any]) => {
        const tabName = key;
        const formatData = formatConfig[tabName];

        if (!formatData) {
          logger.warn(`No format configuration found for tab: ${tabName}`);
          return null;
        }

        try {
          const listConfig = value.list;
          let url = listConfig.url;

          if (listConfig.path_variable) {
            Object.keys(listConfig.path_variable).forEach((pathKey) => {
              url = url.replace(
                `{${pathKey}}`,
                listConfig.path_variable[pathKey]
              );
            });
          }

          const result = await axios({
            method: listConfig.method,
            url: url,
            headers: listConfig.headers,
            params: listConfig.params,
            data: listConfig.body,
          });

          const apiData = Array.isArray(result.data)
            ? result.data
            : [result.data];

            const processedData = apiData.map((item) => {
              const flattenedItem = flattenObject(item);
              const rawJson: Record<string, any> = {};
              const tableFieldsData: Record<string, any> = {};
          
              Object.entries(formatData.fieldMappings as FieldMappings).forEach(
                  ([originalKey, mappedKey]) => {
                      const value = _.get(item, mappedKey);
                      if (value !== undefined) {
                          rawJson[originalKey] = value;
                      }
                  }
              );
          
              formatData.tableFields.forEach((field) => {
                  const value = _.get(item, field.original);
                  if (value !== undefined) {
                      tableFieldsData[field.display] = value;
                  }
              });
          
              return {
                  raw_json: rawJson,
                  tableFieldsData,
              };
          });

          return {
            tab_name: tabName.toLowerCase(),
            row: value.row,
            list_data: processedData,
          };
        } catch (apiError) {
          logger.error(`API Error for tab ${tabName}: ${apiError.message}`);
          return {
            tab_name: tabName.toLowerCase(),
            row: value.row,
            list_data: [],
          };
        }
      })
    );

    return {
      data: tab_list.filter(Boolean),
    };
  } catch (error) {
    logger.error(`Error in newModelDataForDashboard: ${error.message}`);
    throw new Error("Failed to process dashboard data");
  }
}


async function configureDataModel(
  resolvedData: any,
  requestData: JourneyRequest
): Promise<any> {
  try {
    const sampleJsonPath = path.join(
      process.cwd(),
      "src/configs/defaultCache/sample.json"
    );

    if (requestData?.data?.list) {
      const currentSampleConfig = JSON.parse(
        fs.readFileSync(sampleJsonPath, "utf8")
      );

      const newTabName = requestData.data.tab_name;
      currentSampleConfig[newTabName] = {
        row: parseInt(requestData.data.row) || 1,
        list: {
          name: requestData.data.list.name || "",
          url: requestData.data.list.url,
          method: requestData.data.list.method,
          headers: requestData.data.list.headers,
          params: requestData.data.list.params || {},
          body: requestData.data.list.body || {},
          path_variable: requestData.data.list.path_variable || {},
        },
        actions: [],
      };

      try {
        fs.writeFileSync(
          sampleJsonPath,
          JSON.stringify(currentSampleConfig, null, 4)
        );
        logger.debug(`Updated sample.json with new tab: ${newTabName}`);
      } catch (writeError) {
        logger.error(`Error writing to sample.json: ${writeError.message}`);
      }

      const requestListConfig = requestData.data.list;
      let requestUrl = requestListConfig.url;

      if (requestListConfig.path_variable) {
        Object.keys(requestListConfig.path_variable).forEach((pathKey) => {
          requestUrl = requestUrl.replace(
            `{${pathKey}}`,
            requestListConfig.path_variable[pathKey]
          );
        });
      }

      try {
        const result = await axios({
          method: requestListConfig.method,
          url: requestUrl,
          headers: {
            "X-SOURCE-ID": requestListConfig.headers["X-SOURCE-ID"],
            "Content-Type": "application/json",
            "Cookie": requestListConfig.headers["Cookie"]
          },
          params: requestListConfig.params,
          data: {
            policyNumber: requestListConfig.body.policynumber,
            include_expired: Boolean(requestListConfig.body.include_expired)
          }
        });

        return {
          data: {
            tab_name: requestData.data.tab_name.toLowerCase(),
            row: parseInt(requestData.data.row) || 1,
            list_data: Array.isArray(result.data) ? result.data : [result.data],
          },
        };
      } catch (apiError) {
        logger.error(`API Error for request tab: ${apiError.message}`);
        return {
          data: {
            tab_name: requestData.data.tab_name.toLowerCase(),
            row: parseInt(requestData.data.row) || 1,
            list_data: [],
          },
        };
      }
    }
    return { data: [] };
  } catch (error) {
    logger.error(`Error in configureDataModel: ${error}`);
    throw new Error("Failed to configure data model");
  }
}

async function formatToSave(
  resolvedData: any,
  requestData: JourneyRequest,
  requestHeaders: any
): Promise<any> {
  try {
    console.log("request data", requestData);
    if (!requestData?.data?.configuredModel) {
      logger.debug("Missing required data in request");
      return { success: false, error: "Missing required data" };
    }

    const formatToSavePath = path.join(
      process.cwd(),
      "src/configs/defaultCache/formatTosave.json"
    );

    const configData = {
      [`${requestData.data.configuredModel.tab_name}`]: {
        row: requestData.data.configuredModel.row,
        fieldMappings: requestData.data.configuredModel.fieldMappings,
        tableFields: requestData.data.configuredModel.tableFields,
      },
    };

    let existingData = {};
    if (fs.existsSync(formatToSavePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(formatToSavePath, "utf8"));
      } catch (readError) {
        logger.error(
          `Error reading existing formatTosave.json: ${readError.message}`
        );
      }
    }

    const updatedConfig = {
      ...existingData,
      ...configData,
    };
    try {
      fs.writeFileSync(
        formatToSavePath,
        JSON.stringify(updatedConfig, null, 4)
      );
      logger.debug(
        `Updated formatTosave.json for tab: ${requestData.data.tab_name}`
      );
      return { success: true };
    } catch (writeError) {
      logger.error(`Error writing to formatTosave.json: ${writeError.message}`);
      throw new Error("Failed to save configuration");
    }
  } catch (error) {
    logger.error(`Error in formatToSave: ${error.message}`);
    throw new Error("Failed to save configuration");
  }
}


interface FieldMappings {
  [key: string]: string;
}

interface FormatData {
  row: number;
  fieldMappings: FieldMappings;
  tableFields: Array<{
    original: string;
    display: string;
  }>;
}

async function newModelDataForDashboard(
  resolvedData: any,
  requestData: JourneyRequest
): Promise<any> {
  console.log("resolvedData", resolvedData);
  console.log("requestData", requestData);
  try {
    const sampleJsonPath = path.join(
      process.cwd(),
      "src/configs/defaultCache/sample.json"
    );
    const formatToSavePath = path.join(
      process.cwd(),
      "src/configs/defaultCache/formatTosave.json"
    );

    if (!fs.existsSync(sampleJsonPath) || !fs.existsSync(formatToSavePath)) {
      throw new Error("Required configuration files not found");
    }

    const sampleConfig = JSON.parse(fs.readFileSync(sampleJsonPath, "utf8"));
    const formatConfig = JSON.parse(fs.readFileSync(formatToSavePath, "utf8"));

    const tab_list = await Promise.all(
      Object.entries(sampleConfig).map(async ([key, value]: [string, any]) => {
        const tabName = key;
        const formatData = formatConfig[tabName];

        if (!formatData) {
          logger.warn(`No format configuration found for tab: ${tabName}`);
          return null;
        }

        try {
          const listConfig = value.list;
          let url = listConfig.url;

          if (listConfig.path_variable) {
            Object.keys(listConfig.path_variable).forEach((pathKey) => {
              url = url.replace(
                `{${pathKey}}`,
                listConfig.path_variable[pathKey]
              );
            });
          }

          const result = await axios({
            method: listConfig.method,
            url: url,
            headers: listConfig.headers,
            params: listConfig.params,
            data: listConfig.body,
          });

          const apiData = Array.isArray(result.data)
            ? result.data
            : [result.data];

          const processedData = apiData.map((item) => {
            const flattenedItem = flattenObject(item);
            const rawJson: Record<string, any> = {};
            const tableFieldsData: Record<string, any> = {};

            Object.entries(formatData.fieldMappings as FieldMappings).forEach(
              ([originalKey, mappedKey]) => {
                if (flattenedItem.hasOwnProperty(originalKey)) {
                  rawJson[mappedKey as string] = flattenedItem[originalKey];
                }
              }
            );

            formatData.tableFields.forEach((field) => {
              if (flattenedItem.hasOwnProperty(field.original)) {
                tableFieldsData[field.display] = flattenedItem[field.original];
              }
            });

            return {
              raw_json: rawJson,
              tableFieldsData,
            };
          });

          return {
            tab_name: tabName.toLowerCase(),
            row: value.row,
            list_data: processedData,
          };
        } catch (apiError) {
          logger.error(`API Error for tab ${tabName}: ${apiError.message}`);
          return {
            tab_name: tabName.toLowerCase(),
            row: value.row,
            list_data: [],
          };
        }
      })
    );

    return {
      data: tab_list.filter(Boolean),
    };
  } catch (error) {
    logger.error(`Error in newModelDataForDashboard: ${error.message}`);
    throw new Error("Failed to process dashboard data");
  }
}

async function getParticularTabData(
  resolvedData: any,
  requestData: JourneyRequest
): Promise<any> {
  try {
    if (!requestData?.data?.tab_name) {
      logger.debug("No tab name provided in request data");
      return { data: null };
    }

    const sampleJsonPath = path.join(
      process.cwd(),
      "src/configs/defaultCache/sample.json"
    );
    const formatToSavePath = path.join(
      process.cwd(),
      "src/configs/defaultCache/formatTosave.json"
    );

    if (!fs.existsSync(sampleJsonPath) || !fs.existsSync(formatToSavePath)) {
      throw new Error("Required configuration files not found");
    }

    const sampleConfig = JSON.parse(fs.readFileSync(sampleJsonPath, "utf8"));
    const formatConfig = JSON.parse(fs.readFileSync(formatToSavePath, "utf8"));

    const tabName = requestData.data.tab_name;
    const tabConfig = sampleConfig[tabName];
    const formatData = formatConfig[tabName];

    if (!tabConfig || !formatData) {
      logger.warn(`Configuration not found for tab: ${tabName}`);
      return { data: null };
    }

    try {
      const listConfig = tabConfig.list;
      let url = listConfig.url;

      if (listConfig.path_variable) {
        Object.keys(listConfig.path_variable).forEach((pathKey) => {
          url = url.replace(
            `{${pathKey}}`,
            listConfig.path_variable[pathKey]
          );
        });
      }

      const result = await axios({
        method: listConfig.method,
        url: url,
        headers: listConfig.headers,
        params: listConfig.params,
        data: listConfig.body,
      });

      const apiData = Array.isArray(result.data) ? result.data : [result.data];

      const processedData = apiData.map((item) => {
        const flattenedItem = flattenObject(item);
        const rawJson: Record<string, any> = {};
        const tableFieldsData: Record<string, any> = {};

        Object.entries(formatData.fieldMappings as FieldMappings).forEach(
          ([originalKey, mappedKey]) => {
            const value = _.get(item, mappedKey);
            if (value !== undefined) {
              rawJson[originalKey] = value;
            }
          }
        );

        formatData.tableFields.forEach((field) => {
          const value = _.get(item, field.original);
          if (value !== undefined) {
            tableFieldsData[field.display] = value;
          }
        });

        return {
          raw_json: rawJson,
          tableFieldsData,
        };
      });

      return {
        data: {
          tab_name: tabName.toLowerCase(),
          row: tabConfig.row,
          list_data: processedData,
        },
      };

    } catch (apiError) {
      logger.error(`API Error for tab ${tabName}: ${apiError.message}`);
      return {
        data: {
          tab_name: tabName.toLowerCase(),
          row: tabConfig.row,
          list_data: [],
        },
      };
    }
  } catch (error) {
    logger.error(`Error in getParticularTabData: ${error.message}`);
    throw new Error("Failed to get tab data");
  }
}






module.exports = {
  getTabNameList,
  getTabInfo,
  resolveAction,
  dataForDashboard,
  newModelDataForDashboard,
  configureDataModel,
  formatToSave,
  getParticularTabData
};
