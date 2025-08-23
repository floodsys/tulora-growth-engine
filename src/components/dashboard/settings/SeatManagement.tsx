import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, Plus, Minus } from "lucide-react"
import { toast } from "sonner"

const seatData = {
  total: 10,
  used: 7,
  available: 3
}

const memberSeats = [
  {
    id: "1",
    name: "John Doe",
    email: "john@acme.com",
    role: "owner",
    seatActive: true
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@acme.com",
    role: "admin",
    seatActive: true
  },
  {
    id: "3",
    name: "Bob Wilson",
    email: "bob@acme.com",
    role: "member",
    seatActive: true
  },
  {
    id: "4",
    name: "Alice Johnson",
    email: "alice@acme.com",
    role: "member",
    seatActive: false
  }
]

export function SeatManagement() {
  const [newSeatCount, setNewSeatCount] = useState(seatData.total)

  const handleUpdateSeats = () => {
    // TODO: Implement seat count update
    toast.success(`Seat count updated to ${newSeatCount}`)
  }

  const handleToggleSeat = (memberId: string, memberName: string, currentStatus: boolean) => {
    if (!currentStatus && seatData.available === 0) {
      toast.error("No available seats. Please add more seats first.")
      return
    }
    
    // TODO: Implement seat toggle
    const action = currentStatus ? "deactivated" : "activated"
    toast.success(`Seat ${action} for ${memberName}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Seat Management</h1>
        <p className="text-muted-foreground">Manage organization seats and member access</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Seats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{seatData.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Used Seats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{seatData.used}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available Seats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{seatData.available}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Modify Seat Count</span>
          </CardTitle>
          <CardDescription>Add or remove seats from your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label htmlFor="seatCount">Number of Seats</Label>
              <Input
                id="seatCount"
                type="number"
                value={newSeatCount}
                onChange={(e) => setNewSeatCount(Number(e.target.value))}
                min="1"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setNewSeatCount(Math.max(1, newSeatCount - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setNewSeatCount(newSeatCount + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Current: {seatData.total} seats • New: {newSeatCount} seats
              </p>
              {newSeatCount !== seatData.total && (
                <p className="text-sm font-medium">
                  {newSeatCount > seatData.total 
                    ? `Adding ${newSeatCount - seatData.total} seats` 
                    : `Removing ${seatData.total - newSeatCount} seats`
                  }
                </p>
              )}
            </div>
            <Button 
              onClick={handleUpdateSeats}
              disabled={newSeatCount === seatData.total}
            >
              Update Seats
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member Seat Status</CardTitle>
          <CardDescription>Manage which members have active seats</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Seat Status</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberSeats.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === "owner" ? "destructive" : "secondary"}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.seatActive ? "default" : "secondary"}>
                      {member.seatActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.role !== "owner" && (
                      <Button
                        variant={member.seatActive ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleToggleSeat(member.id, member.name, member.seatActive)}
                      >
                        {member.seatActive ? "Deactivate" : "Activate"}
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