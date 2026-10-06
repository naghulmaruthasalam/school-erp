import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge, Modal } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import {
  Bus, MapPin, Users, Plus, Wrench, UserPlus, Route, Phone, User,
  Fuel, Shield, Calendar, Trash2, Edit3, ChevronRight, Navigation
} from "lucide-react";

interface Vehicle {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  driver_license: string | null;
  helper_name: string | null;
  helper_phone: string | null;
  status: string;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
}

interface TransportRoute {
  id: string;
  route_name: string;
  route_code: string;
  vehicle_id: string | null;
  vehicle_no: string | null;
  stops: { name: string; pickup_time?: string; drop_time?: string; fare?: number }[];
  is_active: boolean;
}

interface StudentAssignment {
  id: string;
  student_id: string;
  student_name: string;
  student_class: string;
  route_id: string;
  route_name: string;
  stop_name: string;
  monthly_fee: number;
  is_active: boolean;
}

interface TransportStats {
  total_vehicles: number;
  active_vehicles: number;
  total_routes: number;
  students_using_transport: number;
}

interface Student {
  id: string;
  full_name: string;
  admission_no: string;
  class_name?: string;
}

interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
}

export default function TransportList() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"vehicles" | "routes" | "assignments">("vehicles");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [showAssignStudent, setShowAssignStudent] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<TransportRoute | null>(null);

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_no: "", vehicle_type: "BUS", capacity: 40,
    driver_name: "", driver_phone: "", driver_license: "",
    helper_name: "", helper_phone: "",
    insurance_expiry: "", fitness_expiry: ""
  });

  const [routeForm, setRouteForm] = useState({
    route_name: "", route_code: "", vehicle_id: "",
    stops: [{ name: "", pickup_time: "", drop_time: "", fare: 0 }]
  });

  const [assignForm, setAssignForm] = useState({
    student_id: "", student_name: "", student_class: "",
    route_id: "", stop_name: "", monthly_fee: 0, academic_year_id: ""
  });

  const statsQuery = useQuery({
    queryKey: ["transport", "stats"],
    queryFn: async () => {
      const { data } = await api.get<TransportStats>("/transport/stats");
      return data;
    },
  });

  const vehiclesQuery = useQuery({
    queryKey: ["transport", "vehicles"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Vehicle>>("/transport/vehicles", { params: { page_size: 100 } });
      return data;
    },
  });

  const routesQuery = useQuery({
    queryKey: ["transport", "routes"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<TransportRoute>>("/transport/routes", { params: { active_only: false, page_size: 100 } });
      return data;
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["transport", "assignments"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<StudentAssignment>>("/transport/assignments", { params: { page_size: 200 } });
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["students-for-transport"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Student>>("/students", { params: { status: "ACTIVE", page_size: 500 } });
      return data;
    },
  });

  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<AcademicYear>>("/academics/years");
      return data;
    },
  });

  const addVehicleMutation = useMutation({
    mutationFn: async (payload: typeof vehicleForm) => {
      const { data } = await api.post("/transport/vehicles", {
        ...payload,
        driver_license: payload.driver_license || null,
        helper_name: payload.helper_name || null,
        helper_phone: payload.helper_phone || null,
        insurance_expiry: payload.insurance_expiry || null,
        fitness_expiry: payload.fitness_expiry || null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport"] });
      setShowAddVehicle(false);
      resetVehicleForm();
    },
  });

  const addRouteMutation = useMutation({
    mutationFn: async (payload: typeof routeForm) => {
      const { data } = await api.post("/transport/routes", {
        route_name: payload.route_name,
        route_code: payload.route_code,
        vehicle_id: payload.vehicle_id || null,
        stops: payload.stops.filter(s => s.name.trim()),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport"] });
      setShowAddRoute(false);
      resetRouteForm();
    },
  });

  const assignStudentMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/transport/assignments", assignForm);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport"] });
      setShowAssignStudent(false);
      resetAssignForm();
    },
  });

  const resetVehicleForm = () => {
    setVehicleForm({
      vehicle_no: "", vehicle_type: "BUS", capacity: 40,
      driver_name: "", driver_phone: "", driver_license: "",
      helper_name: "", helper_phone: "",
      insurance_expiry: "", fitness_expiry: ""
    });
  };

  const resetRouteForm = () => {
    setRouteForm({
      route_name: "", route_code: "", vehicle_id: "",
      stops: [{ name: "", pickup_time: "", drop_time: "", fare: 0 }]
    });
  };

  const resetAssignForm = () => {
    setAssignForm({
      student_id: "", student_name: "", student_class: "",
      route_id: "", stop_name: "", monthly_fee: 0, academic_year_id: ""
    });
  };

  const addStop = () => {
    setRouteForm({
      ...routeForm,
      stops: [...routeForm.stops, { name: "", pickup_time: "", drop_time: "", fare: 0 }]
    });
  };

  const removeStop = (index: number) => {
    setRouteForm({
      ...routeForm,
      stops: routeForm.stops.filter((_, i) => i !== index)
    });
  };

  const updateStop = (index: number, field: string, value: string | number) => {
    const newStops = [...routeForm.stops];
    newStops[index] = { ...newStops[index], [field]: value };
    setRouteForm({ ...routeForm, stops: newStops });
  };

  const handleStudentSelect = (studentId: string) => {
    const student = studentsQuery.data?.items.find(s => s.id === studentId);
    if (student) {
      setAssignForm({
        ...assignForm,
        student_id: student.id,
        student_name: student.full_name,
        student_class: student.class_name || ""
      });
    }
  };

  const handleRouteSelect = (routeId: string) => {
    const route = routesQuery.data?.items.find(r => r.id === routeId);
    setSelectedRoute(route || null);
    setAssignForm({ ...assignForm, route_id: routeId, stop_name: "" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "green";
      case "MAINTENANCE": return "yellow";
      default: return "red";
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Transport Management" subtitle="Manage vehicles, routes, and student assignments">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAddVehicle(true)} className="gap-2">
            <Bus className="w-4 h-4" /> Add Vehicle
          </Button>
          <Button variant="secondary" onClick={() => setShowAddRoute(true)} className="gap-2">
            <Route className="w-4 h-4" /> Add Route
          </Button>
          <Button onClick={() => setShowAssignStudent(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Assign Student
          </Button>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Vehicles", value: statsQuery.data?.total_vehicles ?? 0, icon: Bus, color: "blue" },
          { label: "Active Vehicles", value: statsQuery.data?.active_vehicles ?? 0, icon: Shield, color: "green" },
          { label: "Routes", value: statsQuery.data?.total_routes ?? 0, icon: MapPin, color: "violet" },
          { label: "Students Using", value: statsQuery.data?.students_using_transport ?? 0, icon: Users, color: "orange" },
        ].map((stat, i) => (
          <div key={i} className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-${stat.color}-500/10 to-${stat.color}-600/5 border border-${stat.color}-200/50 p-4 group hover:shadow-lg transition-all duration-300`}>
            <div className={`absolute top-3 right-3 w-10 h-10 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {statsQuery.isLoading ? <Spinner /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "vehicles", label: "Vehicles", icon: Bus, count: vehiclesQuery.data?.total },
          { id: "routes", label: "Routes", icon: MapPin, count: routesQuery.data?.total },
          { id: "assignments", label: "Student Assignments", icon: Users, count: assignmentsQuery.data?.total },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                : "bg-white text-slate-600 hover:bg-violet-50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20" : "bg-slate-100"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vehicles Tab */}
      {activeTab === "vehicles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehiclesQuery.isLoading ? (
            <div className="col-span-full flex justify-center py-12"><Spinner /></div>
          ) : vehiclesQuery.data?.items.map((vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                    <Bus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{vehicle.vehicle_no}</h3>
                    <p className="text-sm text-slate-500">{vehicle.vehicle_type} · {vehicle.capacity} seats</p>
                  </div>
                </div>
                <Badge tone={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{vehicle.driver_name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{vehicle.driver_phone}</span>
                </div>
                {vehicle.helper_name && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>Helper: {vehicle.helper_name}</span>
                  </div>
                )}
              </div>

              {(vehicle.insurance_expiry || vehicle.fitness_expiry) && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  {vehicle.insurance_expiry && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <Shield className="w-3 h-3" />
                      <span>Ins: {new Date(vehicle.insurance_expiry).toLocaleDateString()}</span>
                    </div>
                  )}
                  {vehicle.fitness_expiry && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>Fit: {new Date(vehicle.fitness_expiry).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
          {vehiclesQuery.data?.items.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-12">
              No vehicles added yet. Add your first vehicle!
            </div>
          )}
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === "routes" && (
        <div className="space-y-4">
          {routesQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : routesQuery.data?.items.map((route) => (
            <Card key={route.id} className="hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{route.route_name}</h3>
                    <p className="text-sm text-slate-500">Code: {route.route_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {route.vehicle_no && (
                    <Badge tone="blue">
                      <Bus className="w-3 h-3 mr-1" />{route.vehicle_no}
                    </Badge>
                  )}
                  <Badge tone={route.is_active ? "green" : "gray"}>
                    {route.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {route.stops.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                    <Navigation className="w-4 h-4" /> Stops ({route.stops.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {route.stops.map((stop, i) => (
                      <div key={i} className="flex items-center text-sm">
                        <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-lg">{stop.name}</span>
                        {i < route.stops.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
          {routesQuery.data?.items.length === 0 && (
            <Card className="text-center text-slate-400 py-12">
              No routes added yet. Create your first route!
            </Card>
          )}
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === "assignments" && (
        <Card>
          <h3 className="font-semibold text-violet-900 flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" /> Student Transport Assignments
          </h3>
          {assignmentsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Student</th>
                    <th className="pb-3 font-medium">Class</th>
                    <th className="pb-3 font-medium">Route</th>
                    <th className="pb-3 font-medium">Stop</th>
                    <th className="pb-3 font-medium">Monthly Fee</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentsQuery.data?.items.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-slate-50 hover:bg-violet-50/50 transition-colors">
                      <td className="py-4 font-medium text-slate-800">{assignment.student_name}</td>
                      <td className="py-4 text-slate-600">{assignment.student_class}</td>
                      <td className="py-4 text-slate-600">{assignment.route_name}</td>
                      <td className="py-4 text-slate-600">{assignment.stop_name}</td>
                      <td className="py-4 text-slate-600">₹{assignment.monthly_fee}</td>
                      <td className="py-4 text-center">
                        <Badge tone={assignment.is_active ? "green" : "gray"}>
                          {assignment.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assignmentsQuery.data?.items.length === 0 && (
                <p className="text-center text-slate-400 py-12">No students assigned yet.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Add Vehicle Modal */}
      <Modal open={showAddVehicle} onClose={() => { setShowAddVehicle(false); resetVehicleForm(); }} title="Add New Vehicle">
        <form onSubmit={(e) => { e.preventDefault(); addVehicleMutation.mutate(vehicleForm); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Vehicle No *</label>
              <input type="text" value={vehicleForm.vehicle_no} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_no: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Type</label>
              <select value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500">
                <option value="BUS">Bus</option>
                <option value="VAN">Van</option>
                <option value="MINI_BUS">Mini Bus</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Capacity</label>
              <input type="number" min={1} value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: parseInt(e.target.value) || 1 })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Driver Name *</label>
              <input type="text" value={vehicleForm.driver_name} onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Driver Phone *</label>
              <input type="text" value={vehicleForm.driver_phone} onChange={(e) => setVehicleForm({ ...vehicleForm, driver_phone: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Driver License</label>
              <input type="text" value={vehicleForm.driver_license} onChange={(e) => setVehicleForm({ ...vehicleForm, driver_license: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Helper Name</label>
              <input type="text" value={vehicleForm.helper_name} onChange={(e) => setVehicleForm({ ...vehicleForm, helper_name: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Helper Phone</label>
              <input type="text" value={vehicleForm.helper_phone} onChange={(e) => setVehicleForm({ ...vehicleForm, helper_phone: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Insurance Expiry</label>
              <input type="date" value={vehicleForm.insurance_expiry} onChange={(e) => setVehicleForm({ ...vehicleForm, insurance_expiry: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Fitness Expiry</label>
              <input type="date" value={vehicleForm.fitness_expiry} onChange={(e) => setVehicleForm({ ...vehicleForm, fitness_expiry: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowAddVehicle(false); resetVehicleForm(); }}>Cancel</Button>
            <Button type="submit" disabled={addVehicleMutation.isPending}>
              {addVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Route Modal */}
      <Modal open={showAddRoute} onClose={() => { setShowAddRoute(false); resetRouteForm(); }} title="Add New Route">
        <form onSubmit={(e) => { e.preventDefault(); addRouteMutation.mutate(routeForm); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Route Name *</label>
              <input type="text" value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required placeholder="e.g., North Route" />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Route Code *</label>
              <input type="text" value={routeForm.route_code} onChange={(e) => setRouteForm({ ...routeForm, route_code: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required placeholder="e.g., R001" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Assign Vehicle</label>
            <select value={routeForm.vehicle_id} onChange={(e) => setRouteForm({ ...routeForm, vehicle_id: e.target.value })}
              className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500">
              <option value="">-- No Vehicle --</option>
              {vehiclesQuery.data?.items.filter(v => v.status === "ACTIVE").map(v => (
                <option key={v.id} value={v.id}>{v.vehicle_no} ({v.vehicle_type})</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-violet-700">Stops</label>
              <Button type="button" variant="secondary" size="sm" onClick={addStop}>
                <Plus className="w-3 h-3 mr-1" /> Add Stop
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {routeForm.stops.map((stop, i) => (
                <div key={i} className="flex gap-2 items-center p-2 bg-slate-50 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <input type="text" placeholder="Stop Name" value={stop.name} onChange={(e) => updateStop(i, "name", e.target.value)}
                    className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" />
                  <input type="time" value={stop.pickup_time} onChange={(e) => updateStop(i, "pickup_time", e.target.value)}
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-sm" title="Pickup Time" />
                  <input type="number" placeholder="Fare" value={stop.fare || ""} onChange={(e) => updateStop(i, "fare", parseFloat(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm" />
                  {routeForm.stops.length > 1 && (
                    <button type="button" onClick={() => removeStop(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowAddRoute(false); resetRouteForm(); }}>Cancel</Button>
            <Button type="submit" disabled={addRouteMutation.isPending}>
              {addRouteMutation.isPending ? "Adding..." : "Add Route"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Student Modal */}
      <Modal open={showAssignStudent} onClose={() => { setShowAssignStudent(false); resetAssignForm(); }} title="Assign Student to Transport">
        <form onSubmit={(e) => { e.preventDefault(); assignStudentMutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Academic Year *</label>
            <select value={assignForm.academic_year_id} onChange={(e) => setAssignForm({ ...assignForm, academic_year_id: e.target.value })}
              className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required>
              <option value="">-- Select Year --</option>
              {yearsQuery.data?.items.map(y => (
                <option key={y.id} value={y.id}>{y.name} {y.is_current && "(Current)"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Student *</label>
            <select value={assignForm.student_id} onChange={(e) => handleStudentSelect(e.target.value)}
              className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required>
              <option value="">-- Select Student --</option>
              {studentsQuery.data?.items.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Route *</label>
            <select value={assignForm.route_id} onChange={(e) => handleRouteSelect(e.target.value)}
              className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required>
              <option value="">-- Select Route --</option>
              {routesQuery.data?.items.filter(r => r.is_active).map(r => (
                <option key={r.id} value={r.id}>{r.route_name} ({r.route_code})</option>
              ))}
            </select>
          </div>
          {selectedRoute && selectedRoute.stops.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Stop *</label>
              <select value={assignForm.stop_name} onChange={(e) => setAssignForm({ ...assignForm, stop_name: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" required>
                <option value="">-- Select Stop --</option>
                {selectedRoute.stops.map((s, i) => (
                  <option key={i} value={s.name}>{s.name} {s.fare ? `(₹${s.fare})` : ""}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Monthly Fee</label>
            <input type="number" min={0} value={assignForm.monthly_fee} onChange={(e) => setAssignForm({ ...assignForm, monthly_fee: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowAssignStudent(false); resetAssignForm(); }}>Cancel</Button>
            <Button type="submit" disabled={assignStudentMutation.isPending}>
              {assignStudentMutation.isPending ? "Assigning..." : "Assign Student"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
