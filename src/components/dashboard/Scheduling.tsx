import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar, Clock, User, Video, MapPin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, format } from "date-fns"

interface Appointment {
  id: string
  title: string
  description: string
  attendeeEmail: string
  attendeeName: string
  scheduledAt: Date
  duration: number
  type: "video" | "phone" | "in-person"
  status: "scheduled" | "confirmed" | "cancelled"
  meetingLink?: string
  location?: string
}

const mockAppointments: Appointment[] = [
  {
    id: "1",
    title: "Product Demo - Acme Corp",
    description: "Demo of AI outreach platform features and pricing discussion",
    attendeeEmail: "john@acme.com",
    attendeeName: "John Smith",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    duration: 60,
    type: "video",
    status: "confirmed",
    meetingLink: "https://meet.google.com/abc-defg-hij"
  },
  {
    id: "2",
    title: "Follow-up Call - TechStart",
    description: "Follow-up discussion after initial interest call",
    attendeeEmail: "jane@techstart.io",
    attendeeName: "Jane Doe",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
    duration: 30,
    type: "phone",
    status: "scheduled"
  },
  {
    id: "3",
    title: "Contract Discussion - Global Solutions",
    description: "Contract terms and implementation timeline discussion",
    attendeeEmail: "bob@global.com",
    attendeeName: "Bob Wilson",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    duration: 45,
    type: "video",
    status: "scheduled",
    meetingLink: "https://zoom.us/j/123456789"
  }
]

export function Scheduling() {
  const [appointments, setAppointments] = useState(mockAppointments)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    attendeeEmail: "",
    attendeeName: "",
    date: "",
    time: "",
    duration: "30",
    type: "video" as "video" | "phone" | "in-person"
  })
  const { toast } = useToast()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success text-success-foreground"
      case "scheduled":
        return "bg-warning text-warning-foreground"
      case "cancelled":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />
      case "phone":
        return <Clock className="h-4 w-4" />
      case "in-person":
        return <MapPin className="h-4 w-4" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Mock API call to /api/schedule
      const scheduledAt = new Date(`${formData.date}T${formData.time}`)
      
      const newAppointment: Appointment = {
        id: Date.now().toString(),
        title: formData.title,
        description: formData.description,
        attendeeEmail: formData.attendeeEmail,
        attendeeName: formData.attendeeName,
        scheduledAt,
        duration: parseInt(formData.duration),
        type: formData.type,
        status: "scheduled",
        meetingLink: formData.type === "video" ? "https://meet.google.com/new-meeting" : undefined
      }

      setAppointments(prev => [newAppointment, ...prev])
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        attendeeEmail: "",
        attendeeName: "",
        date: "",
        time: "",
        duration: "30",
        type: "video"
      })

      toast({
        title: "Meeting Scheduled",
        description: `Meeting with ${formData.attendeeName} has been scheduled successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to schedule meeting. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleCancel = (appointmentId: string) => {
    setAppointments(prev => prev.map(apt => 
      apt.id === appointmentId 
        ? { ...apt, status: "cancelled" as const }
        : apt
    ))
    
    toast({
      title: "Meeting Cancelled",
      description: "The meeting has been cancelled successfully.",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scheduling</h2>
        <p className="text-muted-foreground">
          Schedule and manage meetings with prospects and customers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule New Meeting */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule New Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Product Demo - Company Name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the meeting purpose"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="attendeeName">Attendee Name</Label>
                  <Input
                    id="attendeeName"
                    value={formData.attendeeName}
                    onChange={(e) => setFormData(prev => ({ ...prev, attendeeName: e.target.value }))}
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="attendeeEmail">Attendee Email</Label>
                  <Input
                    id="attendeeEmail"
                    type="email"
                    value={formData.attendeeEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, attendeeEmail: e.target.value }))}
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select value={formData.duration} onValueChange={(value) => setFormData(prev => ({ ...prev, duration: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type">Meeting Type</Label>
                  <Select value={formData.type} onValueChange={(value: "video" | "phone" | "in-person") => setFormData(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video Call</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="in-person">In Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments
                .filter(apt => apt.status !== "cancelled" && apt.scheduledAt > new Date())
                .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
                .slice(0, 5)
                .map((appointment) => (
                <div key={appointment.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{appointment.title}</h4>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {appointment.attendeeName}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {format(appointment.scheduledAt, "MMM d, yyyy 'at' h:mm a")}
                    </div>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(appointment.type)}
                      {appointment.duration} minutes • {appointment.type}
                    </div>
                  </div>

                  {appointment.meetingLink && (
                    <div className="mt-2">
                      <a 
                        href={appointment.meetingLink}
                        className="text-primary text-sm hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join Meeting
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Attendee</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-medium">{appointment.title}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{appointment.attendeeName}</p>
                      <p className="text-sm text-muted-foreground">{appointment.attendeeEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{format(appointment.scheduledAt, "MMM d, yyyy")}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(appointment.scheduledAt, "h:mm a")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{appointment.duration} min</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(appointment.type)}
                      <span className="capitalize">{appointment.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {appointment.status !== "cancelled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(appointment.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}