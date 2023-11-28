
![vwlog_v2 drawio](https://github.com/GemeenteNijmegen/verwerkingenlogging/assets/7393481/5c3a991d-70c6-412e-ab21-424ac728306f)

# 1. Application(s)
Verschillende applicaties die een verwerking uitvoeren en kunnen dit vervolgens loggen naar het verwerkingenlogging register. Hiervoor wordt een API (3) blootgesteld waarnaar de applicaties, afhankelijk van de verwerking, verschillende verzoeken kunnen sturen.

# 2. Verzoeken (standaard)
De verzoeken die uitgevoerd kunnen worden richting de API (3), gebaseerd op de VNG standaard 'Bewerking API voor logging van verwerkingen': 
- GET /verwerkingsacties
- POST /verwerkingsacties
- PATCH /verwerkingsacties
- GET /verwerkingsacties/{actieId}
- PUT /verwerkingsacties/{actieId}
- DELETE /verwerkingsacties/{actieId}

# 3. API Gateway
De API gateway is opgesteld aan de hand van de standaard zoals beschreven in de VNG 'Bewerking API voor logging van verwerkingen'. Aan de gateway hangt een lambda integratie. Via deze integratie worden alle binnenkomende verzoeken doorgestuurd naar de Gen Lambda (5).

# 4. Instant Response
De applicaties moeten een instant response krijgen om het proces aan de applicatie kant verder uit te kunnen voeren. (als een direct response niet nodig is dan zullen de applicaties hier mee om moeten kunnen gaan. En moet dit proces opgenomen worden in de standaard). In het geval van een POST en PUT request moet de response bestaan uit het volledige originele request. In het geval van een POST wordt de response uitgebreid met een actieId en een URL. Een PUT request heeft deze informatie al. De [Gen Lambda (5) is verantwoordelijk voor de afhandeling van dit proces.

# 5. Gen Lambda
De actieId en URL worden gegenereerd in de lamdba. In het geval van een POST request voegt de lambda het originele request samen met de gegenereerde actieId en URL tot een nieuwe message. Vervolgens wordt de message terug gestuurd (instant response) naar de applications (1) via de API gateway (3). De message wordt ook naar een S3 bucket (6) gestuurd als backup en als laatste naar de SQS message queue (7) gestuurd voor verdere verwerking van de message.

# 6. Backup (S3)
Voor de backup wordt een S3 Bucket gebruikt. Zodra de message volledig is wordt deze weggeschreven naar de S3 Bucket. Zo blijft er een manier om op een later moment een (verloren) message opnieuw in te dienen.

# 7. Message Queue
De message wordt vervolgens naar de queue gestuurd. Hiervoor wordt een SQS queue gebruikt. Aan deze SQS queue hangt een DLQ (Dead Letter Queue) voor alle messages die niet succesvol worden afgeleverd. Een niet succesvolle aflevering betekent in dit geval dat de message niet van de queue naar de Proc Lambda (8) kan worden verstuurd. Het gebruik van een queue geeft de mogelijkheid om meerdere message als bulk naar de lambda te versturen. De lambda kan vervolgens de messages in bulk verwerken.

# 8. Proc Lambda
De Proc Lambda ontvangt message(s) vanuit de SQS message queue (7). Afhankelijk van het request type wordt de message verwerkt. De volgende request types kunnen binnenkomen: POST, PUT, DELETE en PATCH.

## 8a. POST / PUT request type
Om een nieuwe verwerkingsactie aan te maken kan de applicatie een POST request versturen naar de API. Zodra de message bij de Proc Lambda terecht komt wordt deze verwerkt. De verwerken bestaat uit het wegschrijven van de gehele message naar een nieuwe record in de database.

Als een verwerkingsactie gewijzigd moet worden kan de applicatie een PUT request versturen naar de API. Een vergelijkbare verwerking wordt uitgevoerd op de Proc Lambda als bij POST. Het verschil zit eerder in het proces. Bij een PUT request is het actieId en URL al bekend. Voor de Proc Lambda is er geen wezenlijk verschil betreft het verwerken van de message. De message opzet die vanuit de message queue binnenkomt is voor de POST en PUT requests hetzelfde.

## 8b. DELETE request type
Om een verwerkingsactie te verwijderen kan de applicatie een DELETE request versturen naar de API. Een specifieke actieId wordt meegeven aan de request. Aan de hand van deze actieId zal er direct vanuit de API Gateway een verwijder verzoek gaan naar de database. Een response naar de applicatie is enkel nodig als er iets fout gaat gedurende het verwijderproces.

## 8c. PATCH request type 
Het is ook mogelijk voor applicatie(s) om een verzoek in te dienen die een verwerkingsactie gedeeltelijk wijzigt. Hierbij is het mogelijk om de 'bewaartermijn' en de 'vertrouwelijkheid' van een verwerkingsactie te wijzigen. Als request paramter wordt een verwerkingId meegegeven. Aan de hand van de verwerkingId wordt bepaald welke verwerkingsacties allemaal een wijziging nodig hebben. Dit betekent dat alle verwerkingsacties die dit specifieke verwerkingID hebben (lees: verwerkingsacties die onder deze verwerking vallen) een wijziging nodig hebben. De Proc Lamdba maakt een verzoek richting de database om al deze records aan te passen. Een response naar de applicatie is enkel nodig als er iets fout gaat gedurende het wijzigingsproces.

# 9. Database
Uiteindelijk schrijft de Proc Lambda de message weg naar een DynamoDB database als nieuwe verwerking.

# 10. Direct Verzoek
Vanuit de API Gateway kan een directe GET en DELETE verzoek worden gemaakt naar DynamoDB. Het alternatief zou zijn om dit via een lambda te laten lopen. Deze lambda zit tussen de API gateway en de Database in.
