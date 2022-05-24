import { test, expect, APIRequestContext } from '@playwright/test';

let apiContext: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
    require('dotenv').config()
    apiContext = await playwright.request.newContext({
      // All requests we send go to this API endpoint.
      baseURL: process.env.BASE_URL,
      extraHTTPHeaders: {
        // Add authorization token to all requests.
        // Assuming personal access token available in the environment.
        'X-Api-Key': `${process.env.API_TOKEN}`,
    },
    });
  })
  
  test.afterAll(async ({ }) => {
    // Dispose all responses.
    await apiContext.dispose();
  });
test('Get verwerkingsacties for specific BSN in time range', async ({}) => {
    const results = await apiContext.get('verwerkingsacties?objecttype=persoon&soortObjectId=BSN&objectId=1234567&beginDatum=2024-04-05T14:35:42+01:00&eindDatum=2024-04-05T14:36:42+01:00&verwerkingsactiviteitId=5f0bef4c-f66f-4311-84a5-19e8bf359eaf&vertrouwelijkheid=normaal')
    expect(results.status()).toBe(200);
});

test('Get specific verwerkings actie actie-id', async ({}) => {
    const results = await apiContext.get('https://g423bazyr0.execute-api.eu-west-1.amazonaws.com/dev/verwerkingsacties/492fd26f-da73-11ec-b65e-abbf437284a9?actieId=492fd26f-da73-11ec-b65e-abbf437284a9')
    const json = await results.json();
    expect(json).toEqual(expect.objectContaining({
        actieId: '492fd26f-da73-11ec-b65e-abbf437284a9',
        actieNaam: 'Zoeken personen'
      }));
    expect(results.status()).toBe(200);
});