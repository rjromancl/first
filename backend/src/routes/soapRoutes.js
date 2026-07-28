const express = require('express');
const router = express.Router();

const WSDL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions name="BAirwaysService"
    targetNamespace="http://bairways.com/soap"
    xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
    xmlns:tns="http://bairways.com/soap"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema">

    <wsdl:types>
        <xsd:schema targetNamespace="http://bairways.com/soap">
            <xsd:element name="GetFlightStatusRequest">
                <xsd:complexType>
                    <xsd:sequence>
                        <xsd:element name="flightNumber" type="xsd:string"/>
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>
            <xsd:element name="GetFlightStatusResponse">
                <xsd:complexType>
                    <xsd:sequence>
                        <xsd:element name="flightNumber" type="xsd:string"/>
                        <xsd:element name="status" type="xsd:string"/>
                        <xsd:element name="departureAirport" type="xsd:string"/>
                        <xsd:element name="arrivalAirport" type="xsd:string"/>
                        <xsd:element name="departureTime" type="xsd:string"/>
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>
        </xsd:schema>
    </wsdl:types>

    <wsdl:message name="GetFlightStatusInput">
        <wsdl:part name="parameters" element="tns:GetFlightStatusRequest"/>
    </wsdl:message>
    <wsdl:message name="GetFlightStatusOutput">
        <wsdl:part name="parameters" element="tns:GetFlightStatusResponse"/>
    </wsdl:message>

    <wsdl:portType name="BAirwaysPortType">
        <wsdl:operation name="GetFlightStatus">
            <wsdl:input message="tns:GetFlightStatusInput"/>
            <wsdl:output message="tns:GetFlightStatusOutput"/>
        </wsdl:operation>
    </wsdl:portType>

    <wsdl:binding name="BAirwaysBinding" type="tns:BAirwaysPortType">
        <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
        <wsdl:operation name="GetFlightStatus">
            <soap:operation soapAction="http://bairways.com/soap/GetFlightStatus"/>
            <wsdl:input><soap:body use="literal"/></wsdl:input>
            <wsdl:output><soap:body use="literal"/></wsdl:output>
        </wsdl:operation>
    </wsdl:binding>

    <wsdl:service name="BAirwaysService">
        <wsdl:port name="BAirwaysPort" binding="tns:BAirwaysBinding">
            <soap:address location="http://localhost:4000/soap"/>
        </wsdl:port>
    </wsdl:service>
</wsdl:definitions>`;

// WSDL Contract endpoint
router.get('/wsdl', (req, res) => {
  res.type('application/xml');
  res.send(WSDL_XML);
});

// SOAP Endpoint
router.post('/', express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'] }), (req, res) => {
  const xmlBody = req.body || '';

  let action = 'GetFlightStatus';
  if (xmlBody.includes('BookFlight')) action = 'BookFlight';
  if (xmlBody.includes('CheckIn')) action = 'CheckIn';
  if (xmlBody.includes('GetAvios')) action = 'GetAvios';

  const flightMatch = xmlBody.match(/<flightNumber>(.*?)<\/flightNumber>/i);
  const flightNum = flightMatch ? flightMatch[1] : 'BA117';

  const pnrMatch = xmlBody.match(/<pnr>(.*?)<\/pnr>/i);
  const pnr = pnrMatch ? pnrMatch[1] : 'BA-89241';

  let responseBodyXml = '';

  if (action === 'BookFlight') {
    responseBodyXml = `
      <tns:BookFlightResponse xmlns:tns="http://bairways.com/soap">
        <tns:pnr>${pnr}</tns:pnr>
        <tns:status>CONFIRMED</tns:status>
        <tns:message>Booking successfully confirmed with B Airways</tns:message>
      </tns:BookFlightResponse>`;
  } else if (action === 'CheckIn') {
    responseBodyXml = `
      <tns:CheckInResponse xmlns:tns="http://bairways.com/soap">
        <tns:pnr>${pnr}</tns:pnr>
        <tns:boardingPassUrl>https://first-eight-cyan.vercel.app/check-in?pnr=${pnr}</tns:boardingPassUrl>
        <tns:status>BOARDING_PASS_ISSUED</tns:status>
      </tns:CheckInResponse>`;
  } else if (action === 'GetAvios') {
    responseBodyXml = `
      <tns:GetAviosResponse xmlns:tns="http://bairways.com/soap">
        <tns:balance>42500</tns:balance>
        <tns:tier>Gold</tns:tier>
      </tns:GetAviosResponse>`;
  } else {
    responseBodyXml = `
      <tns:GetFlightStatusResponse xmlns:tns="http://bairways.com/soap">
        <tns:flightNumber>${flightNum}</tns:flightNumber>
        <tns:status>ON TIME</tns:status>
        <tns:departureAirport>LHR</tns:departureAirport>
        <tns:arrivalAirport>JFK</tns:arrivalAirport>
        <tns:departureTime>08:25 AM GMT</tns:departureTime>
      </tns:GetFlightStatusResponse>`;
  }

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    ${responseBodyXml}
  </soapenv:Body>
</soapenv:Envelope>`;

  res.type('text/xml');
  res.status(200).send(soapEnvelope);
});

module.exports = router;
