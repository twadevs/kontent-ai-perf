import { green, yellow } from "colors";
import { writeFile, readFile } from "fs/promises";
import {
  exportFilename,
  managementClient,
  sourceImageFilename,
  iterations
} from "./config";
import { SharedModels } from "@kontent-ai/management-sdk";

const jsonFilename = exportFilename + ".json";

interface IPerfResult {
  min: number;
  max: number;
  avg: number;
}

interface IPerfResults {
  info: string;
  uploadFile: {
    name: string;
    sizeInBytes: number;
  };
  viewAsset: IPerfResult;
  uploadBinaryData: IPerfResult;
  createAsset: IPerfResult;
  viewContentItem: IPerfResult;
  createContentItem: IPerfResult;
  upsertLanguageVariant: IPerfResult;
  publishVariant: IPerfResult;
}

function calculateStats(data: number[]): IPerfResult {
  return {
    min: Math.min(...data),
    max: Math.max(...data),
    avg: data.reduce((a, b) => a + b, 0) / data.length,
  };
}


interface IAssetPerfResult {
  viewAssetMs: number;
  uploadBinaryDataMs: number;
  createAssetMs: number;
}

/* 
The `INewContentItemPerfResult` interface defines the structure of the performance results for
creating a new content item in Kontent. 
*/
interface INewContentItemPerfResult {
  viewContentItemMs: number;
  createContentItemMs: number;  
  upsertLanguageVariantMs: number;
  publishVariantMs: number;
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
  const newContentItemResults: INewContentItemPerfResult[] = [];

  for (let i = 0; i < iterations; i++) {
    assetResults.push(
      await handleAssetAsync({ image: sourceImage, iteration: i + 1 })
    );

    newContentItemResults.push(
      await handleNewContentItemAsync({ iteration: i + 1 })
    );

  }

  const viewAssetMs = assetResults.map((m) => m.viewAssetMs);
  const uploadBinaryDataMs = assetResults.map((m) => m.uploadBinaryDataMs);
  const createAssetMs = assetResults.map((m) => m.createAssetMs);
  const viewContentItemMs = newContentItemResults.map((m) => m.viewContentItemMs);
  const createContentItemMs = newContentItemResults.map((m) => m.createContentItemMs);
  const upsertLanguageVariantMs = newContentItemResults.map((m) => m.upsertLanguageVariantMs);
  const publishVariantMs = newContentItemResults.map((m) => m.publishVariantMs);
  

  const perfResult: IPerfResults = {
    info: `Results are in ms`,
    uploadFile: {
      name: sourceImageFilename,
      sizeInBytes: sourceImage.byteLength,
    },
    viewAsset: calculateStats(viewAssetMs),
    uploadBinaryData: calculateStats(uploadBinaryDataMs),
    createAsset: calculateStats(createAssetMs),
    viewContentItem: calculateStats(viewContentItemMs),
    createContentItem: calculateStats(createContentItemMs),
    upsertLanguageVariant: calculateStats(upsertLanguageVariantMs),
    publishVariant: calculateStats(publishVariantMs)        
  };

  console.log(`${green("Results")}: `, perfResult);

  await writeFile(jsonFilename, JSON.stringify(perfResult));
  console.log(
    `File '${yellow(jsonFilename)}' with results successfully created`
  );
};


// -------------------------------------------------------
// -------------------------------------------------------
// CONTENT ITEM
// -------------------------------------------------------
// -------------------------------------------------------

async function handleNewContentItemAsync(data: {
  iteration: number;
}): Promise<INewContentItemPerfResult> {
  console.log(
    `Handling creating new content item. Iteration '${yellow(data.iteration.toString())}'`
  );
  
  const codename = `perf_deal_${randomString()}`;

  console.log(`Checking if content item exists. Codename: ${codename}`);
  const startTimeViewContentItem = performance.now();
  try {
    const existingContentItem = await managementClient
      .viewContentItem()
      .byItemCodename(codename)      
      .toPromise();
  } catch (err) {
    if (is404Error(err)) {
      // skip 404
    } else {
      throw err;
    }
  }  
  const viewContentItemTimeElapsed = performance.now() - startTimeViewContentItem;

  console.log(`Adding new item. Codename: ${codename}`);
  const startTimeCreateItem = performance.now();
  try{
  const addItemResponse = await managementClient
    .addContentItem()
    .withData({
      name: `Perf Test Content Item - ${randomString()}`,      
      type: { codename: "deal"},
      codename: codename
    })
    .toPromise();  
  }
  catch(err){
    console.log(err);
    throw err;
  }
  const createItemTimeElapsed = performance.now() - startTimeCreateItem;

  console.log(`Upsert new variant. Codename: ${codename}`);
  const startTimeUpsertData = performance.now();
  const upsertResponse = await managementClient
    .upsertLanguageVariant()    
    .byItemCodename(codename)      
    .byLanguageCodename("en")
    .withData((builder) => {
      return {
        elements: [
          builder.textElement({ element: { codename: "alternate_note" }, value: "Perf Test Content Item" }),
          builder.textElement({ element: { codename: "campaign_tracking_code" }, value: "Perf Test Content Item" }),
          builder.numberElement({ element: { codename: "amount" }, value: 100 })
        ]
      }
    })
    .toPromise();  
  const upsertTimeElapsed = performance.now() - startTimeUpsertData;

  console.log(`Publish variant. Codename: ${codename}`);
  const startTimePublish = performance.now();
  const publishResponse = await managementClient
    .publishLanguageVariant()
    .byItemCodename(codename)
    .byLanguageCodename("en")    
    .withoutData()
    .toPromise();

  const publishTimeElapsed = performance.now() - startTimePublish;

  return {  
    viewContentItemMs: viewContentItemTimeElapsed,
    createContentItemMs: createItemTimeElapsed,
    upsertLanguageVariantMs: upsertTimeElapsed,
    publishVariantMs: publishTimeElapsed
  } as INewContentItemPerfResult;

}


// -------------------------------------------------------
// -------------------------------------------------------
// ASSET
// -------------------------------------------------------
// -------------------------------------------------------

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
