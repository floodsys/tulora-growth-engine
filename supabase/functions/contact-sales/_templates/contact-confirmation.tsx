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

interface ContactConfirmationProps {
  name: string
}

export const ContactConfirmationEmail = ({ name }: ContactConfirmationProps) => (
  <Html>
    <Head />
    <Preview>Thanks — we got your message</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks for reaching out!</Heading>
        <Text style={text}>
          Hi {name},
        </Text>
        <Text style={text}>
          Thanks for reaching out to Tulora — your request is confirmed.
        </Text>
        <Text style={text}>
          We’ll be in touch soon to refine what you’d like to build and outline scope, timeline, and pricing.
        </Text>
        <Text style={footer}>
          — The Tulora Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ContactConfirmationEmail

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