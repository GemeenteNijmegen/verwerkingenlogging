## Testen van de verwerkingenlogging-API-implementatie

De tests bestaan uit twee delen: code-tests (in test/api) en validatie-tests op de live api (in test/validation).

### Codetests
Deze tests maken gebruik van [pytest](https://docs.pytest.org/en/7.1.x/). Lokaal kun je ze uitvoeren:

Installatie dependencies:
```
pip install pipenv
pipenv install --dev
```
De tests kun je draaien door in de root van de repo uit te voeren:
`pipenv run pytest`

In de build-pipeline draaien ze door een aanpassing in de GitHub build-workflow ook.

De verwerkingenlogging-lambda is opgesplitst in verschillende functies per route/resource. De tests testen op dit moment nog het 'hele' proces, van lambda event t/m http-response. Dit om te zorgen dat de tests vanaf de oorspronkelijke opbouw van de code af bleven werken.

### Validatietests
Deze tests maken gebruik van [jest](https://jestjs.io) (zoals projen default ook doet). Deze kunnen lokaal uitgevoerd worden door `yarn jest -c jest.validation.config.json` uit te voeren. De environment variables API_TOKEN en BASE_URL moeten ingesteld zijn. Deze zijn nog niet meegenomen in de build / deploy. Er moet nog bekeken worden hoe de benodigde api-key + url het best gedeeld kunnen worden in de deploy. Zie #34
