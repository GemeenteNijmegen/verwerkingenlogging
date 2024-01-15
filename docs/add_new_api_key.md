# How to add a new api key (step by step)
1. Go to the 'ApiStack.ts'
2. Add a new API key by code: ```const key = this.verwerkingenAPI.addApiKey('verwerkingen-api-key');```
3. Add newly created key to usage plan: ```plan.addApiKey(key);```
4. (Optional) create own usage plan
5. Push changes

By pushing and thereby deploying these changes AWS will create a new API key. This key can be acquired in the AWS console, within the API gateway service under API keys.

The usage plan can be used to define more refined access to the API, both on API level and method level. See: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html