import { green, yellow } from "colors";
import { writeFile, readFile } from "fs/promises";
import {
  exportFilename,
  managementClient,
  sourceImageFilename,
} from "./config";
import { SharedModels } from "@kontent-ai/management-sdk";

const iterations: number = 100;
const jsonFilename = exportFilename + ".json";

interface IPerfResult {
  info: string;
  uploadFile: {
    name: string;
    sizeInBytes: number;
  };
  viewAsset: {
    min: number;
    max: number;
    avg: number;
  };
  uploadBinaryData: {
    min: number;
    max: number;
    avg: number;
  };
  createAsset: {
    min: number;
    max: number;
    avg: number;
  };
}

interface IAssetPerfResult {
  viewAssetMs: number;
  uploadBinaryDataMs: number;
  createAssetMs: number;
}

const run = async () => {
  console.log(green(`Starting app`));
  const environmentInfo = await managementClient
    .environmentInformation()
    .toPromise();

  console.log(
    `Starting perf test for project '${yellow(
      environmentInfo.data.project.name
    )}' and environment '${yellow(environmentInfo.data.project.environment)}'`
  );

  const sourceImage = await readFile(sourceImageFilename);

  const assetResults: IAssetPerfResult[] = [];

  for (let i = 0; i < iterations; i++) {
    assetResults.push(
      await handleAssetAsync({ image: sourceImage, iteration: i + 1 })
    );
  }

  const perfResult: IPerfResult = {
    info: `Results are in ms`,
    uploadFile: {
      name: sourceImageFilename,
      sizeInBytes: sourceImage.byteLength,
    },
    viewAsset: {
      min: Math.min(...assetResults.map((m) => m.viewAssetMs)),
      max: Math.max(...assetResults.map((m) => m.viewAssetMs)),
      avg:
        assetResults.map((m) => m.viewAssetMs).reduce((a, b) => a + b, 0) /
        assetResults.length,
    },
    uploadBinaryData: {
      min: Math.min(...assetResults.map((m) => m.uploadBinaryDataMs)),
      max: Math.max(...assetResults.map((m) => m.uploadBinaryDataMs)),
      avg:
        assetResults
          .map((m) => m.uploadBinaryDataMs)
          .reduce((a, b) => a + b, 0) / assetResults.length,
    },
    createAsset: {
      min: Math.min(...assetResults.map((m) => m.createAssetMs)),
      max: Math.max(...assetResults.map((m) => m.createAssetMs)),
      avg:
        assetResults.map((m) => m.createAssetMs).reduce((a, b) => a + b, 0) /
        assetResults.length,
    },
  };

  console.log(`${green("Results")}: `, perfResult);

  await writeFile(jsonFilename, JSON.stringify(perfResult));
  console.log(
    `File '${yellow(jsonFilename)}' with results successfully created`
  );
};

async function handleAssetAsync(data: {
  image: Buffer;
  iteration: number;
}): Promise<IAssetPerfResult> {
  console.log(
    `Handling asset. Iteration '${yellow(data.iteration.toString())}'`
  );
  const startTimeViewAsset = performance.now();
  try {
    const existingAsset = await managementClient
      .viewAsset()
      .byAssetId(randomString())
      .toPromise();
  } catch (err) {
    if (is404Error(err)) {
      // skip 404
    } else {
      throw err;
    }
  }

  const endTimeViewAsset = performance.now();
  const viewAssetTimeElapsed = endTimeViewAsset - startTimeViewAsset;

  const startTimeUploadBinary = performance.now();
  const uploadBinaryResponse = await managementClient
    .uploadBinaryFile()
    .withData({
      binaryData: data.image,
      contentType: "image/jpg",
      filename: randomString(),
      contentLength: data.image.byteLength,
    })
    .toPromise();
  const endTimeUploadBinary = performance.now();
  const uploadBinaryTimeElapsed = endTimeUploadBinary - startTimeUploadBinary;

  const startTimeCreateAsset = performance.now();
  const createAssetResponse = await managementClient
    .addAsset()
    .withData((builder) => {
      return {
        file_reference: uploadBinaryResponse.data,
        title: `${sourceImageFilename} - ${randomString()}`,
      };
    })
    .toPromise();
  const endTimeCreateAsset = performance.now();
  const createAssetTimeElapsed = endTimeCreateAsset - startTimeCreateAsset;

  return {
    createAssetMs: createAssetTimeElapsed,
    uploadBinaryDataMs: uploadBinaryTimeElapsed,
    viewAssetMs: viewAssetTimeElapsed,
  };
}

function randomString(): string {
  return String(
    Math.random().toString(16) +
      Date.now().toString(32) +
      Math.random().toString(16)
  ).replace(/\./g, "");
}
function is404Error(error: any): boolean {
  if (
    error instanceof SharedModels.ContentManagementBaseKontentError &&
    error.originalError?.response?.status === 404
  ) {
    return true;
  }

  return false;
}

run();
