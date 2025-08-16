const axios = require('axios');

async function testAIAppointment() {
  try {
    const response = await axios.post('http://localhost:3000/ai-appointments', {
      clientName: 'John Doe',
      clientPhone: '5551234567',
      appointmentAddress: '123 Main St, Las Vegas, NV 89101',
      price: 150.00,
      date: '2024-01-15',
      time: '10:00',
      notes: 'Test AI appointment',
      size: '1500-2000',
      adminId: 1
    });

    console.log('Success! AI Appointment created:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error creating AI appointment:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAIAppointment();
