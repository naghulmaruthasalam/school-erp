import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge, Modal } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import {
  BookOpen, Search, Plus, Users, AlertTriangle, BookMarked, RotateCcw,
  CheckCircle, Clock
} from "lucide-react";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  category: string | null;
  subject: string | null;
  total_copies: number;
  available_copies: number;
  rack_number: string | null;
  shelf_number: string | null;
  price: number | null;
}

interface BookIssue {
  id: string;
  book_id: string;
  book_title: string;
  borrower_id: string;
  borrower_name: string;
  borrower_type: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  fine_amount: number;
  fine_paid: boolean;
}

interface LibraryStats {
  total_books: number;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  pending_issues: number;
  overdue_issues: number;
}

interface Student {
  id: string;
  full_name: string;
  admission_no: string;
}

const CATEGORIES = ["Fiction", "Non-Fiction", "Science", "Mathematics", "History", "Literature", "Reference", "Comics", "Biography", "Other"];

export default function LibraryList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"books" | "issues">("books");
  const [showAddBook, setShowAddBook] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<BookIssue | null>(null);
  const [bookForm, setBookForm] = useState({
    title: "", author: "", isbn: "", publisher: "", category: "", subject: "",
    total_copies: 1, rack_number: "", shelf_number: "", price: 0
  });
  const [issueForm, setIssueForm] = useState({
    borrower_id: "", borrower_name: "", borrower_type: "STUDENT", days: 14
  });
  const [returnForm, setReturnForm] = useState({ fine_amount: 0, fine_paid: false, remarks: "" });

  const statsQuery = useQuery({
    queryKey: ["library", "stats"],
    queryFn: async () => {
      const { data } = await api.get<LibraryStats>("/library/stats");
      return data;
    },
  });

  const booksQuery = useQuery({
    queryKey: ["library", "books", search],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Book>>("/library/books", {
        params: { search: search || undefined, page_size: 100 },
      });
      return data;
    },
  });

  const issuesQuery = useQuery({
    queryKey: ["library", "issues"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<BookIssue>>("/library/issues", {
        params: { pending_only: true, page_size: 100 },
      });
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["students-for-library"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Student>>("/students", { params: { status: "ACTIVE", page_size: 500 } });
      return data;
    },
  });

  const addBookMutation = useMutation({
    mutationFn: async (payload: typeof bookForm) => {
      const { data } = await api.post("/library/books", {
        ...payload,
        price: payload.price || null,
        isbn: payload.isbn || null,
        publisher: payload.publisher || null,
        rack_number: payload.rack_number || null,
        shelf_number: payload.shelf_number || null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      setShowAddBook(false);
      resetBookForm();
    },
  });

  const issueBookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBook) return;
      const { data } = await api.post("/library/issues", {
        book_id: selectedBook.id,
        borrower_id: issueForm.borrower_id,
        borrower_name: issueForm.borrower_name,
        borrower_type: issueForm.borrower_type,
        days: issueForm.days,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      setShowIssueModal(false);
      setSelectedBook(null);
      setIssueForm({ borrower_id: "", borrower_name: "", borrower_type: "STUDENT", days: 14 });
    },
  });

  const returnBookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIssue) return;
      const { data } = await api.post(`/library/issues/${selectedIssue.id}/return`, returnForm);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      setShowReturnModal(false);
      setSelectedIssue(null);
      setReturnForm({ fine_amount: 0, fine_paid: false, remarks: "" });
    },
  });

  const resetBookForm = () => {
    setBookForm({ title: "", author: "", isbn: "", publisher: "", category: "", subject: "", total_copies: 1, rack_number: "", shelf_number: "", price: 0 });
  };

  const handleStudentSelect = (studentId: string) => {
    const student = studentsQuery.data?.items.find(s => s.id === studentId);
    if (student) {
      setIssueForm({ ...issueForm, borrower_id: student.id, borrower_name: student.full_name });
    }
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Library Management" subtitle="Manage books, issue and track returns">
        <Button onClick={() => setShowAddBook(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Book
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Books", value: statsQuery.data?.total_books ?? 0, icon: BookOpen, color: "violet" },
          { label: "Total Copies", value: statsQuery.data?.total_copies ?? 0, icon: BookMarked, color: "blue" },
          { label: "Available", value: statsQuery.data?.available_copies ?? 0, icon: CheckCircle, color: "green" },
          { label: "Issued", value: statsQuery.data?.issued_copies ?? 0, icon: Users, color: "orange" },
          { label: "Pending", value: statsQuery.data?.pending_issues ?? 0, icon: Clock, color: "yellow" },
          { label: "Overdue", value: statsQuery.data?.overdue_issues ?? 0, icon: AlertTriangle, color: "red" },
        ].map((stat, i) => (
          <div key={i} className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-${stat.color}-500/10 to-${stat.color}-600/5 border border-${stat.color}-200/50 p-4 group hover:shadow-lg hover:shadow-${stat.color}-500/10 transition-all duration-300`}>
            <div className={`absolute top-3 right-3 w-10 h-10 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <p className="text-sm font-medium text-ink-3">{stat.label}</p>
            <p className="text-2xl font-bold text-ink mt-1">
              {statsQuery.isLoading ? <Spinner /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("books")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "books" ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30" : "bg-surface text-ink-2 hover:bg-violet-50"}`}
        >
          <BookOpen className="w-4 h-4 inline-block mr-2" />Books Catalog
        </button>
        <button
          onClick={() => setActiveTab("issues")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "issues" ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30" : "bg-surface text-ink-2 hover:bg-violet-50"}`}
        >
          <RotateCcw className="w-4 h-4 inline-block mr-2" />Issued Books ({issuesQuery.data?.total ?? 0})
        </button>
      </div>

      {/* Books Tab */}
      {activeTab === "books" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Books Catalog
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search books..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-line focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
          </div>

          {booksQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-ink-3 border-b border-line">
                    <th className="pb-3 font-medium">Book</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Location</th>
                    <th className="pb-3 font-medium text-center">Available</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {booksQuery.data?.items.map((book) => (
                    <tr key={book.id} className="border-b border-line hover:bg-violet-50/50 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-12 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {book.title.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-ink">{book.title}</p>
                            <p className="text-sm text-ink-3">{book.author}</p>
                            {book.isbn && <p className="text-xs text-ink-3">ISBN: {book.isbn}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge tone="violet">{book.category || "General"}</Badge>
                      </td>
                      <td className="py-4 text-sm text-ink-2">
                        {book.rack_number && `Rack ${book.rack_number}`}
                        {book.shelf_number && ` / Shelf ${book.shelf_number}`}
                        {!book.rack_number && !book.shelf_number && "—"}
                      </td>
                      <td className="py-4 text-center">
                        <Badge tone={book.available_copies > 0 ? "green" : "red"}>
                          {book.available_copies}/{book.total_copies}
                        </Badge>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={book.available_copies < 1}
                            onClick={() => { setSelectedBook(book); setShowIssueModal(true); }}
                          >
                            Issue
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {booksQuery.data?.items.length === 0 && (
                <p className="text-center text-ink-3 py-12">No books found. Add your first book!</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Issues Tab */}
      {activeTab === "issues" && (
        <Card>
          <h3 className="font-semibold text-ink flex items-center gap-2 mb-4">
            <RotateCcw className="w-5 h-5" /> Pending Returns
          </h3>
          {issuesQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-ink-3 border-b border-line">
                    <th className="pb-3 font-medium">Book</th>
                    <th className="pb-3 font-medium">Borrower</th>
                    <th className="pb-3 font-medium">Issue Date</th>
                    <th className="pb-3 font-medium">Due Date</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issuesQuery.data?.items.map((issue) => (
                    <tr key={issue.id} className="border-b border-line hover:bg-violet-50/50 transition-colors">
                      <td className="py-4 font-medium text-ink">{issue.book_title}</td>
                      <td className="py-4">
                        <p className="text-ink">{issue.borrower_name}</p>
                        <p className="text-xs text-ink-3">{issue.borrower_type}</p>
                      </td>
                      <td className="py-4 text-sm text-ink-2">
                        {new Date(issue.issue_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-sm text-ink-2">
                        {new Date(issue.due_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-center">
                        <Badge tone={isOverdue(issue.due_date) ? "red" : "yellow"}>
                          {isOverdue(issue.due_date) ? "Overdue" : "Pending"}
                        </Badge>
                      </td>
                      <td className="py-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => { setSelectedIssue(issue); setShowReturnModal(true); }}
                        >
                          Return Book
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {issuesQuery.data?.items.length === 0 && (
                <p className="text-center text-ink-3 py-12">No pending returns.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Add Book Modal */}
      <Modal open={showAddBook} onClose={() => { setShowAddBook(false); resetBookForm(); }} title="Add New Book">
        <form onSubmit={(e) => { e.preventDefault(); addBookMutation.mutate(bookForm); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ink-2 mb-1">Title *</label>
              <input type="text" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Author *</label>
              <input type="text" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">ISBN</label>
              <input type="text" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Publisher</label>
              <input type="text" value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Category</label>
              <select value={bookForm.category} onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500">
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Subject</label>
              <input type="text" value={bookForm.subject} onChange={(e) => setBookForm({ ...bookForm, subject: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">No. of Copies</label>
              <input type="number" min={1} value={bookForm.total_copies} onChange={(e) => setBookForm({ ...bookForm, total_copies: parseInt(e.target.value) || 1 })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Rack Number</label>
              <input type="text" value={bookForm.rack_number} onChange={(e) => setBookForm({ ...bookForm, rack_number: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Shelf Number</label>
              <input type="text" value={bookForm.shelf_number} onChange={(e) => setBookForm({ ...bookForm, shelf_number: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Price</label>
              <input type="number" step="0.01" value={bookForm.price} onChange={(e) => setBookForm({ ...bookForm, price: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowAddBook(false); resetBookForm(); }}>Cancel</Button>
            <Button type="submit" disabled={addBookMutation.isPending}>
              {addBookMutation.isPending ? "Adding..." : "Add Book"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Issue Book Modal */}
      <Modal open={showIssueModal} onClose={() => { setShowIssueModal(false); setSelectedBook(null); }} title={`Issue: ${selectedBook?.title}`}>
        <form onSubmit={(e) => { e.preventDefault(); issueBookMutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Borrower Type</label>
            <select value={issueForm.borrower_type} onChange={(e) => setIssueForm({ ...issueForm, borrower_type: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500">
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
            </select>
          </div>
          {issueForm.borrower_type === "STUDENT" && (
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">Select Student</label>
              <select value={issueForm.borrower_id} onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" required>
                <option value="">-- Select Student --</option>
                {studentsQuery.data?.items.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</option>
                ))}
              </select>
            </div>
          )}
          {issueForm.borrower_type === "TEACHER" && (
            <>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Teacher Name</label>
                <input type="text" value={issueForm.borrower_name} onChange={(e) => setIssueForm({ ...issueForm, borrower_name: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Teacher ID</label>
                <input type="text" value={issueForm.borrower_id} onChange={(e) => setIssueForm({ ...issueForm, borrower_id: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" required />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Loan Period (days)</label>
            <input type="number" min={1} max={90} value={issueForm.days} onChange={(e) => setIssueForm({ ...issueForm, days: parseInt(e.target.value) || 14 })}
              className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowIssueModal(false)}>Cancel</Button>
            <Button type="submit" disabled={issueBookMutation.isPending}>
              {issueBookMutation.isPending ? "Issuing..." : "Issue Book"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Return Book Modal */}
      <Modal open={showReturnModal} onClose={() => { setShowReturnModal(false); setSelectedIssue(null); }} title={`Return: ${selectedIssue?.book_title}`}>
        <form onSubmit={(e) => { e.preventDefault(); returnBookMutation.mutate(); }} className="space-y-4">
          <div className="bg-violet-50 rounded-lg p-4 space-y-2">
            <p><span className="font-medium">Borrower:</span> {selectedIssue?.borrower_name}</p>
            <p><span className="font-medium">Issue Date:</span> {selectedIssue && new Date(selectedIssue.issue_date).toLocaleDateString()}</p>
            <p><span className="font-medium">Due Date:</span> {selectedIssue && new Date(selectedIssue.due_date).toLocaleDateString()}</p>
            {selectedIssue && isOverdue(selectedIssue.due_date) && (
              <p className="text-red-600 font-medium">This book is overdue!</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Fine Amount</label>
            <input type="number" step="0.01" min={0} value={returnForm.fine_amount} onChange={(e) => setReturnForm({ ...returnForm, fine_amount: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="fine_paid" checked={returnForm.fine_paid} onChange={(e) => setReturnForm({ ...returnForm, fine_paid: e.target.checked })}
              className="rounded border-line text-accent-fg focus:ring-violet-500" />
            <label htmlFor="fine_paid" className="text-sm text-ink-2">Fine Paid</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Remarks</label>
            <textarea value={returnForm.remarks} onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowReturnModal(false)}>Cancel</Button>
            <Button type="submit" disabled={returnBookMutation.isPending}>
              {returnBookMutation.isPending ? "Processing..." : "Process Return"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
