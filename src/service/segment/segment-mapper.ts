import { cloneDeep } from "lodash";
import { getProposalSegmentFields } from "src/service/segment/proposalSegmentData";


export default class SegmentData {

    private static sanitizeProperties(data) {
        //function to clear the unnecessary keys in the segment object
        const invalidValues = ["", null, undefined, NaN];
        return Object.entries(data).reduce((acc, [key, value]) => {
            if (!invalidValues.includes(data[key])) {
                acc[key] = value;
            }
            return acc;
        }, {});
    };

    //to-do remove this function
    private static async callSegmentDataEnrichers(resolvedData, requestData, requestHeaders, apiMappings) {
        //function to call missing resolved data that is not present in the enrichers
        let result = {};
        let moduleToInvoke = await import("../../clients/motor-orchestrator");
        let apiCall = apiMappings?.filter(apis => {
            if (resolvedData[apis?.key] == null) {
                return apis;
            }
        });
        let promises = apiCall?.map(mapping => {
            return moduleToInvoke[mapping.api](resolvedData, requestData, requestHeaders)
                .then(response => {
                    const { status, data } = response;
                    return { key: mapping.key, status, data };
                })
                .catch(error => {
                    const status = error.response?.status || 500; // Default to 500 if no status code is available
                    const message = error.response?.data?.message || error.message;
                    return { key: mapping.key, status, message };
                });
        });

        let settledResults = await Promise.allSettled(promises);
        settledResults?.forEach(settledResult => {
            if (settledResult.status === "fulfilled") {
                const { key, data } = settledResult.value;
                result[key] = data;
            } else if (settledResult.status === "rejected") {
                const { key, status, message } = settledResult.reason;
                result[key] = { error: message || `Error with status ${status}` };
            }
        });
        return result;
    }

    private static async getSegmentDataResolvers(resolversList, resolvedData, requestData, requestHeaders) {
        let result = {};
        resolversList?.forEach(api => {
            if (resolvedData[api]) {
                result[api] = cloneDeep(resolvedData?.[api]); // Create a copy of the resolver data
            }
        })
        return result;
    }

    public static async getSegmentData(resolvedData, requestData, requestHeaders) {

        let result;
        //define the list of resolvers needed to get for the segment data
        let resolversList = ["mo_proposal", "mo_plans", "mo_plan_details", "getCoupons", "mo_premium"];
        result = await SegmentData.getSegmentDataResolvers(resolversList, resolvedData, requestData, requestHeaders);
        const { mo_proposal } = result;

        //populate the fields in the segemnt object
        let proposalFields = getProposalSegmentFields(mo_proposal);

        let segmentData = {
            ...proposalFields
        }

        result = SegmentData.sanitizeProperties(segmentData);
        return { data: result, status: 200 };
    };
};