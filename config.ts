import { createManagementClient } from "@kontent-ai/management-sdk";
import { HttpService } from "@kontent-ai/core-sdk";

const environmentId: string = "";
const apiKey: string = "";

export const managementClient = createManagementClient({
  environmentId: environmentId,
  apiKey: apiKey,
  httpService: new HttpService({
    logErrorsToConsole: false,
  }),
});

export const exportFilename = `perf-result`;
export const sourceImageFilename = `source-image.jpg`;

export const iterations = 100;