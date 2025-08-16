# AI Appointment API Documentation

## Overview
The AI Appointment endpoint allows AI systems to create appointments automatically by providing basic client and appointment information. The system will handle client lookup/creation, template matching/creation, and appointment scheduling.

## Endpoint
`POST /ai-appointments`

## Request Body
```json
{
  "clientName": "string (required)",
  "clientPhone": "string (required)",
  "appointmentAddress": "string (required)",
  "price": "number (required)",
  "date": "string (required, YYYY-MM-DD format)",
  "time": "string (required, HH:MM format)",
  "notes": "string (optional)",
  "size": "string (required)",
  "adminId": "number (required)"
}
```

### Field Descriptions
- **clientName**: Full name of the client
- **clientPhone**: Phone number (will be normalized to 11-digit format)
- **appointmentAddress**: Full address of the appointment location
- **price**: Cost of the appointment in dollars
- **date**: Appointment date in YYYY-MM-DD format
- **time**: Appointment time in HH:MM format (24-hour)
- **notes**: Additional notes for the appointment (optional)
- **size**: Property size in square feet (e.g., '1500-2000', '2000-2500')
- **adminId**: ID of the admin user creating the appointment

## Response
```json
{
  "success": true,
  "appointment": {
    // Full appointment object with all details
  },
  "client": {
    // Client information (existing or newly created)
  },
  "template": {
    // Template information (existing or newly created)
  },
  "message": "AI appointment created successfully"
}
```

## Process Flow

### 1. Client Lookup/Creation
- Searches for existing client by name OR phone number
- If found: Updates client notes to indicate AI usage
- If not found: Creates new client with "Client created by AI" note

### 2. Property Size
Uses the provided size parameter directly for template matching and appointment creation.

### 3. Template Matching/Creation
- Searches for existing template with matching client, address, price, and size
- If found: Uses existing template
- If not found: Creates new template with "AI created template" notes

### 4. Appointment Creation
Creates appointment with these default settings:
- **Type**: AI
- **Payment Method**: CASH
- **Paid**: false
- **No Team**: true (can be edited later)
- **Status**: APPOINTED
- **AI Created**: true (special flag)

## Special Features

### AI Identification
- All AI-created appointments have `aiCreated: true`
- Client notes include AI usage indication
- Template notes indicate AI creation
- Appointment type is set to "AI"

### No Team Default
- All AI appointments are created with `noTeam: true`
- This allows manual team assignment later
- Can be changed through the regular appointment update endpoint

### Property Size
- Uses the provided size parameter directly
- No automatic estimation - size must be provided by the AI

## Error Handling

### Validation Errors
- Missing required fields return 400 with specific field list
- Invalid phone number format returns 400
- Invalid date/time format returns 400

### Server Errors
- Database errors return 500 with generic error message
- Detailed errors logged on server side

## Example Usage

### Create New Client Appointment
```bash
curl -X POST http://localhost:3000/ai-appointments \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Jane Smith",
    "clientPhone": "555-123-4567",
    "appointmentAddress": "456 Oak Street, Las Vegas, NV 89102",
    "price": 200.00,
    "date": "2024-01-20",
    "time": "14:30",
    "notes": "Deep cleaning needed",
    "size": "2000-2500",
    "adminId": 1
  }'
```

### Use Existing Client
```bash
curl -X POST http://localhost:3000/ai-appointments \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "John Doe",
    "clientPhone": "555-987-6543",
    "appointmentAddress": "789 Pine Ave, Las Vegas, NV 89103",
    "price": 175.00,
    "date": "2024-01-25",
    "time": "09:00",
    "size": "1500-2000",
    "adminId": 1
  }'
```

## Related Endpoints

### Get AI Appointments
`GET /appointments/ai`
- Returns all appointments created by AI
- Excludes deleted, cancelled, or rescheduled appointments
- Includes full appointment details with client and admin info

### Get No Team Appointments
`GET /appointments/no-team`
- Returns all appointments without assigned teams
- Useful for finding AI appointments that need team assignment

## Notes for AI Integration

1. **Phone Number Format**: Accepts various formats, automatically normalizes to 11-digit
2. **Size Requirement**: Size must be provided by the AI - no automatic estimation
3. **Template Reuse**: Automatically finds and reuses existing templates when possible
4. **Client Deduplication**: Prevents duplicate clients by checking name and phone
5. **Audit Trail**: All AI interactions are clearly marked in the database
6. **Flexibility**: Created appointments can be fully edited through regular endpoints

## Security Considerations

- Requires valid adminId for authentication
- All operations are logged on server side
- No sensitive data exposure in error messages
- Input validation prevents injection attacks
