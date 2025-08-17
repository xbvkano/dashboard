const axios = require('axios');

async function testAIAppointment() {
  try {
    const response = await axios.post('http://localhost:3000/ai-appointments', {
      clientName: "Robert T Danner Jr",
      clientPhone: "702-750-4740",
      appointmentAddress: "1708 Pacific Terrace Dr, Las Vegas, NV 89128",
      price: 195.0,
      date: "2025-08-30",
      time: "09:00",
      notes: "No extras requested (baseboards, fridge, oven not included).",
      size: "1500-2000",
      serviceType: "STANDARD"
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Success!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testAIAppointment();
