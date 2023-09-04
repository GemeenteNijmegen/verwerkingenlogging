import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

beforeAll(() => {
  if (process.env.BASE_URL && process.env.API_TOKEN) {
    axios.defaults.baseURL = process.env.BASE_URL;
    axios.defaults.headers.common['X-Api-Key'] = process.env.API_TOKEN;
    return true;
  } else {
    return false;
  }
});

describe('Run GET api calls', () => {
  test('GET verwerkinglogging', async () => {
    const result = await axios.get('verwerkingsacties?objectType=persoon&soortObjectId=BSN&objectId=1234567&beginDatum=2024-04-05T14:35:42+01:00&eindDatum=2024-04-05T14:36:42+01:00&verwerkingsactiviteitId=5f0bef4c-f66f-4311-84a5-19e8bf359eaf&vertrouwelijkheid=normaal');
    expect(result.status).toBe(200);
  });
  test('GET specific actie', async () => {
    const results = await axios.get('verwerkingsacties/492fd26f-da73-11ec-b65e-abbf437284a9?actieId=492fd26f-da73-11ec-b65e-abbf437284a9');
    const json = results.data;
    expect(json).toEqual(expect.objectContaining({
      actieId: '492fd26f-da73-11ec-b65e-abbf437284a9',
      actieNaam: 'Zoeken personen',
    }));
    expect(results.status).toBe(200);
  });
});