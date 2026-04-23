const PUBLIC_KEY = process.env.ANUBIS_PUBLIC_KEY;
const SECRET_KEY = process.env.ANUBIS_SECRET_KEY;
const ANUBIS_URL = 'https://api.anubispay.com.br/v1/transactions';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { amount, customer } = body;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Valor inválido' }),
      };
    }

    const auth = 'Basic ' + Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64');

    const payload = {
      amount,
      paymentMethod: 'pix',
    };

    if (customer) {
      if (customer.name) payload.customer = payload.customer || {};
      if (customer.name) payload.customer.name = customer.name;
      if (customer.email) { payload.customer = payload.customer || {}; payload.customer.email = customer.email; }
      if (customer.cpf) { payload.customer = payload.customer || {}; payload.customer.document = customer.cpf.replace(/\D/g, ''); }
      if (customer.phone) { payload.customer = payload.customer || {}; payload.customer.phone = customer.phone.replace(/\D/g, ''); }
    }

    const response = await fetch(ANUBIS_URL, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.message || 'Erro ao criar transação' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro interno: ' + error.message }),
    };
  }
};
