import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface EnterpriseConfirmationProps {
  name: string
  company?: string
}

export const EnterpriseConfirmationEmail = ({ name, company }: EnterpriseConfirmationProps) => (
  <Html>
    <Head />
    <Preview>Thanks — enterprise team on it</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>We’ve received your enterprise inquiry for Tulora</Heading>
        <Text style={text}>
          Hi {name},
        </Text>
        <Text style={text}>
          Thank you for your interest in Tulora! We have received your enterprise AI request and
          are excited to show you how our solution can benefit your organization.
        </Text>
        <Text style={text}>
          Our enterprise solutions are designed to scale with your business and integrate seamlessly with your existing workflows.
          
          We look forward to speaking with you!
        </Text>
        <Text style={footer}>
          Best regards,<br />
          The Tulora Enterprise Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EnterpriseConfirmationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '580px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  marginTop: '32px',
}