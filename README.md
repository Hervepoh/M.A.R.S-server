# Filter Input Structure
The filter input can now support both simple and complex filters:

## Simple Filter:
json

Copier
{
    "column1": { "value": "value1" },
    "column2": { "value": "value2" }
}

## Complex Filter with Conditions:
json

Copier
{
    "conditions": [
        {
            "operator": "AND",
            "filters": [
                { "field": "column1", "operator": "equals", "value": "value1" },
                { "field": "column2", "operator": "contains", "value": "value2" }
            ]
        },
        {
            "operator": "OR",
            "filters": [
                { "field": "column3", "operator": "gte", "value": 10 },
                { "field": "column4", "operator": "lt", "value": 5 }
            ]
        }
    ]
}
Example Requests
Simple Filtering:
json

Copier
GET /api/audits?page=1&limit=10&filters={"column1":{"value":"value1"},"column2":{"value":"value2"}}
Complex Filtering:
json

Copier
GET /api/audits?page=1&limit=10&filters={"conditions":[{"operator":"AND","filters":[{"field":"column1","operator":"equals","value":"value1"},{"field":"column2","operator":"contains","value":"value2"}]},{"operator":"OR","filters":[{"field":"column3","operator":"gte","value":10},{"field":"column4","operator":"lt","value":5}]}]}

Summary
This implementation allows for both simple and complex filtering using optional AND/OR conditions, providing flexibility for users. You can adjust the specifics based on your actual database schema and application requirements, ensuring that the filter input is well-structured and validated.



Summary of API Requests
Contains:
json

Copier
GET /api/audits?page=1&limit=10&filters={"details":{"operator":"contains","value":"logged"}}
Greater Than or Equal To:
json

Copier
GET /api/audits?page=1&limit=10&filters={"created_at":{"operator":"gte","value":"2025-01-24T00:00:00Z"}}
Less Than or Equal To:
json

Copier
GET /api/audits?page=1&limit=10&filters={"created_at":{"operator":"lte","value":"2025-01-24T02:20:00Z"}}
Greater Than:
json

Copier
GET /api/audits?page=1&limit=10&filters={"created_at":{"operator":"gt","value":"2025-01-24T02:20:00Z"}}
Less Than:
json

Copier
GET /api/audits?page=1&limit=10&filters={"created_at":{"operator":"lt","value":"2025-01-24T02:20:30Z"}}"# M.A.R.S-server" 
