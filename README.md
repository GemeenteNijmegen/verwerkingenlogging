# Verwerkingenlogging
Door VNG-Realisatie is de Verwerkingenlogging API-standaard als onderdeel van de uitwerking van de informatiekundige visie Common Ground ontwikkeld en opgenomen in de GEMMA referentiearchitectuur. Deze API-standaard biedt leveranciers van informatiesystemen gestandaardiseerde API-specificaties voor het vastleggen en ontsluiten van metagegevens behorend bij vastgelegde (gelogde) verwerkingen.

De Gemeente Nijmegen heeft aan de hand van deze standaard een open-source implementatie van de verwerkingenlogging ontwikkeld. De code van deze implementatie is te vinden in deze repository. Meer informatie over de verwerkingenlogging is te vinden op de website van de [VNG-realisatie](https://vng-realisatie.github.io/gemma-verwerkingenlogging/) .

Publicaties:
- Practice logging van verwerking (GEMMA). [source](https://www.gemmaonline.nl/index.php/Practice_logging_van_verwerking)
- Common Ground Portfolio (zilveren status). [source](https://commonground.nl/page/view/b68441ec-e536-4f81-82d8-ce6f3d6606a9/portfolio)

## Hoe te gebruiken?
De verwerkingenlogging is opgedeeld in 2 'kanten'. Aan de ene kant heb je het inschieten van log records (verwerkingen) en aan de andere kant heb je het ophalen van verwerkingen. Het inschieten wordt gedaan door applicaties die bepaalde (persoons)gegevens verwerken. De metadata van deze verwerking kan vervolgens opgestuurd worden naar de verwerkingenlogging. Het ophalen wordt gedaan door applicaties die inzage willen bieden. Dit kan een inzage zijn richting de burger maar ook naar medewerkers van een gemeente.

### 🎯 Inschieten verwerkingen 
Om verwerkingen in te schieten is er een API endpoint beschikbaar. Deze API heeft een POST call waarmee niewe records in de verwerkingenlogging toegevoegd kunnen worden. De [opbouw van de body](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/VNG-Realisatie/gemma-verwerkingenlogging/master/docs/api-write/oas-specification/logging-verwerkingen-api/openapi.yaml) van deze POST call is terug te vinden op de website van de VNG. Verder is er een API Key nodig om verzoeken naar de API te sturen. Deze key is op te vragen bij devops@nijmegen.nl.

- POST https://api.vwlog-accp.csp-nijmegen.nl/verwerkingsacties 

#### 📝 Wijzigen verwerking 
Zodra een record is aangemaakt in de verwerkingenlogging is het mogelijk om deze record te wijzigen en te verwijderen. Voor het wijzigen is een PUT call beschikbaar. Bij een PUT call wordt opnieuw een body verwacht zoals bij de POST. Additioneel moet een 'actieid' mee worden gegeven in het verzoek ``{{endpoint}}/verwerkingsacties/{actieId}``. Dit geeft aan welke actie (log record) aangepast moet worden.

- PUT https://api.vwlog-accp.csp-nijmegen.nl/verwerkingsacties/{actieId}

#### 🗑️ Verwijderen verwerking 
Voor het verwijderen is het proces identiek. Ook hier word ``{{endpoint}}/verwerkingsacties/{actieId}`` gebruikt als verzoek. Het verschil is dat er nu een DEL call wordt gedaan. Bij een DEL call is geen body vereist.

- DEL https://api.vwlog-accp.csp-nijmegen.nl/verwerkingsacties/{actieId}

### 🔎 Ophalen verwerkingen 
Voor het ophalen van verwerkingen uit de verwerkingenlogging bestaan twee verschillende GET calls. 

#### Meerdere verwerkingen
De eerste maakt het mogelijk om alle verwerkingen op te halen die in de verwerkingenlogging beschikbaar zijn. Met behulp van 'parameters' kan er worden gefilterd. De [mogelijke parameters](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/VNG-Realisatie/gemma-verwerkingenlogging/master/docs/api-write/oas-specification/logging-verwerkingen-api/openapi.yaml) zijn te vinden op de website van de VNG.

- GET https://api.vwlog-accp.csp-nijmegen.nl/verwerkingsacties 

#### Enkele verwerking
De tweede GET call maakt het mogelijk om een specifieke verwerking op te halen. Door een actieId mee te geven ``{{endpoint}}/verwerkingsacties/{actieId}``, wordt een specifieke verwerking opgehaald.

- GET https://api.vwlog-accp.csp-nijmegen.nl/verwerkingsacties/{actieId}

## Eigen verwerkingenlogging draaien
De verwerkingenlogging is zo opgezet dat de complete 'applicatie' relatief simpel uitgerold (gedeployed) kan worden op een cloud dienst. De verwerkingenlogging is namelijk ontwikkeld met behulp van Infrastructue as Code (IaC). Deze techniek maakt het mogelijk dat een applicatie zoals de verwerkingenlogging uitgerold kan worden in een cloud omgeving. De IaC van dit project, de verwerkingenlogging, is specifiek geschreven voor Amazon Web Services (AWS).

Om de verwerkingenlogging te deployen met de IaC code is een account op AWS nodig. Verdere instructies om een eigen versie van de verwerkingenlogging te draaien in een AWS omgeving volgen later.