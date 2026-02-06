# ExamRevise Zimbabwe - Complete Development Prompt

## Project Overview

Build a comprehensive, production-ready web application called **"ExamRevise"** that enables Zimbabwean secondary school students (Form 1-6) to access past examination papers from multiple examination boards (ZIMSEC, Cambridge/CAIE, and others), practice answering questions, receive AI-powered marking and feedback, and track their revision progress over time.

**The platform serves three key audiences:**
1. **Individual Students** - Self-directed revision and practice
2. **Teachers** - Class management, assignments, and performance tracking
3. **Schools/Institutions** - School-wide analytics, multi-class management, and parent communication

The platform must be **robust, dependable, scalable, and extremely user-friendly** - designed for students who may have limited internet connectivity and varying device capabilities.

---

## Tech Stack

### Backend
- **Framework**: Django 5.x with Django REST Framework (DRF)
- **Database**: PostgreSQL 15+
- **Authentication**: JWT (djangorestframework-simplejwt) + Django AllAuth for social logins
- **Task Queue**: Celery with Redis broker (for async PDF processing, AI marking, notifications)
- **File Storage**: Django Storages with S3-compatible backend (or local for dev)
- **Caching**: Redis
- **PDF Processing**: PyMuPDF (fitz), pdf2image, Pillow
- **AI Integration**: Anthropic Claude API (claude-sonnet-4-20250514 for marking)
- **Search**: PostgreSQL full-text search (upgrade path to Elasticsearch later)
- **API Documentation**: drf-spectacular (OpenAPI 3.0)
- **Notifications**: WhatsApp Business API (via Twilio or 360dialog), Email (SendGrid/SES)

### Frontend
- **Framework**: React 18+ with Vite
- **Styling**: Tailwind CSS 3.x
- **Animations**: Framer Motion
- **Icons**: Lucide React, React Icons
- **Notifications**: Sonner
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **PDF Viewing**: react-pdf or pdf.js
- **Rich Text**: TipTap or Slate (for essay answers)
- **Charts**: Recharts (for progress tracking and analytics dashboards)
- **Router**: React Router v6

---

## Business Model & Pricing

### Revenue Tiers

| Tier | Target | Price (USD) | Features |
|------|--------|-------------|----------|
| **Free** | Individual students | $0 | 10 papers/month, basic AI marking, ads |
| **Student Premium** | Serious students | $3-5/month | Unlimited papers, full AI feedback, no ads, offline access |
| **Teacher** | Individual teachers | $10/month | 1 class (up to 50 students), assignments, basic analytics |
| **School Basic** | Small schools (<300 students) | $75/month | Up to 300 students, 15 teachers, school dashboard |
| **School Pro** | Medium schools | $150/month | Up to 800 students, unlimited teachers, parent portal, advanced analytics |
| **School Enterprise** | Large schools/groups | $300+/month | Unlimited, API access, dedicated support, custom branding |
| **District** | School groups/NGOs | Custom | Multi-school management, benchmarking, bulk pricing |

### Pricing Psychology for Zimbabwe
- Quote in USD, accept ZiG/bond/Ecocash equivalent
- Offer termly payment (aligns with school budget cycles)
- "Per student" pricing feels fairer for schools
- 20% discount for annual prepayment
- Free tier for rural/underprivileged schools (CSR/PR value)

---

## Database Architecture

### Core Models

#### 1. ExaminationBoard
```python
class ExaminationBoard(models.Model):
    """
    Represents different examination bodies (ZIMSEC, Cambridge, etc.)
    Extensible for future boards.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)  # "ZIMSEC", "Cambridge IGCSE", "Cambridge A-Level"
    short_code = models.CharField(max_length=20, unique=True)  # "ZIMSEC", "CAIE-IGCSE", "CAIE-AL"
    country = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='boards/logos/', null=True, blank=True)
    website_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
```

#### 2. Subject
```python
class Subject(models.Model):
    """
    Academic subjects available across examination boards.
    A subject can belong to multiple boards with different syllabi.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)  # "Mathematics", "Physics", "English Language"
    slug = models.SlugField(unique=True)
    icon = models.CharField(max_length=50, blank=True)  # Lucide icon name
    color = models.CharField(max_length=7, default='#3B82F6')  # Hex color for UI
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
```

#### 3. Syllabus
```python
class Syllabus(models.Model):
    """
    Links a subject to an examination board with specific level/form information.
    Contains the syllabus structure and topics.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    board = models.ForeignKey(ExaminationBoard, on_delete=models.CASCADE, related_name='syllabi')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='syllabi')
    
    # Level information (flexible for different board structures)
    level_name = models.CharField(max_length=50)  # "O-Level", "A-Level", "IGCSE", "Form 3"
    level_code = models.CharField(max_length=20)  # "OL", "AL", "F3"
    
    # Form/Grade mapping (1-6 for Zimbabwe system)
    form_start = models.PositiveSmallIntegerField(default=1)  # e.g., Form 3
    form_end = models.PositiveSmallIntegerField(default=6)    # e.g., Form 4
    
    syllabus_code = models.CharField(max_length=20, blank=True)  # "4024", "9709"
    syllabus_year = models.PositiveIntegerField(null=True, blank=True)  # Syllabus version year
    
    # Syllabus document
    syllabus_pdf = models.FileField(upload_to='syllabi/pdfs/', null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['board', 'subject', 'level_code']
        verbose_name_plural = 'Syllabi'
```

#### 4. Topic
```python
class Topic(models.Model):
    """
    Syllabus topics for organizing questions and tracking mastery.
    Hierarchical structure supports subtopics.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    syllabus = models.ForeignKey(Syllabus, on_delete=models.CASCADE, related_name='topics')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subtopics')
    
    name = models.CharField(max_length=200)
    slug = models.SlugField()
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    
    # Learning objectives
    objectives = models.JSONField(default=list, blank=True)  # ["Understand...", "Apply..."]
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        unique_together = ['syllabus', 'slug']
```

#### 5. Paper
```python
class Paper(models.Model):
    """
    Represents a complete examination paper.
    Stores the original PDF and metadata.
    """
    class PaperType(models.TextChoices):
        FINAL = 'final', 'Final Examination'
        MOCK = 'mock', 'Mock Examination'
        SPECIMEN = 'specimen', 'Specimen Paper'
        PRACTICE = 'practice', 'Practice Paper'

    class Season(models.TextChoices):
        JUNE = 'june', 'June'
        NOVEMBER = 'november', 'November'
        MARCH = 'march', 'March'
        SPECIMEN = 'specimen', 'Specimen'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    syllabus = models.ForeignKey(Syllabus, on_delete=models.CASCADE, related_name='papers')
    
    # Paper identification
    year = models.PositiveIntegerField()
    season = models.CharField(max_length=20, choices=Season.choices)
    paper_number = models.PositiveSmallIntegerField()  # Paper 1, 2, 3
    variant = models.CharField(max_length=10, blank=True)  # For Cambridge variants
    paper_type = models.CharField(max_length=20, choices=PaperType.choices, default=PaperType.FINAL)
    
    # Paper details
    title = models.CharField(max_length=255)
    duration_minutes = models.PositiveIntegerField()
    total_marks = models.PositiveIntegerField()
    instructions = models.TextField(blank=True)
    
    # PDF storage
    pdf_file = models.FileField(upload_to='papers/pdfs/')
    pdf_page_count = models.PositiveIntegerField(default=0)
    
    # Marking scheme
    has_marking_scheme = models.BooleanField(default=False)
    marking_scheme_pdf = models.FileField(upload_to='papers/marking_schemes/', null=True, blank=True)
    
    # Processing status
    class ProcessingStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        NEEDS_REVIEW = 'needs_review', 'Needs Review'

    processing_status = models.CharField(max_length=20, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)
    processing_notes = models.TextField(blank=True)
    
    # Metadata
    is_published = models.BooleanField(default=False)
    difficulty_rating = models.FloatField(null=True, blank=True)  # Calculated from student performance
    times_attempted = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['-year', 'season', 'paper_number']
        unique_together = ['syllabus', 'year', 'season', 'paper_number', 'variant']
```

#### 6. Question
```python
class Question(models.Model):
    """
    Individual question extracted from a paper.
    Stores question content, diagram references, and marking criteria.
    """
    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE = 'mcq', 'Multiple Choice'
        SHORT_ANSWER = 'short', 'Short Answer'
        STRUCTURED = 'structured', 'Structured'
        ESSAY = 'essay', 'Essay'
        CALCULATION = 'calculation', 'Calculation'
        DIAGRAM = 'diagram', 'Diagram/Drawing'
        PRACTICAL = 'practical', 'Practical'
        DATA_RESPONSE = 'data', 'Data Response'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    paper = models.ForeignKey(Paper, on_delete=models.CASCADE, related_name='questions')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='sub_questions')
    
    # Question identification
    question_number = models.CharField(max_length=20)  # "1", "2a", "3b(ii)"
    display_order = models.PositiveIntegerField()
    
    # Question content
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QuestionType.choices)
    marks = models.PositiveIntegerField()
    
    # For MCQ
    options = models.JSONField(null=True, blank=True)  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_option = models.CharField(max_length=5, blank=True)  # "A", "B", "C", "D"
    
    # Diagram handling
    has_diagram = models.BooleanField(default=False)
    diagram_coords = models.JSONField(null=True, blank=True)  
    # {"page": 1, "x": 100, "y": 200, "width": 300, "height": 250}
    diagram_image = models.ImageField(upload_to='questions/diagrams/', null=True, blank=True)
    diagram_description = models.TextField(blank=True)  # Alt text / AI description
    
    # Source reference (for fallback display)
    source_page = models.PositiveIntegerField()
    source_coords = models.JSONField(null=True, blank=True)  # Full question region on PDF
    
    # Marking information
    model_answer = models.TextField(blank=True)
    marking_criteria = models.JSONField(default=list)
    # [{"points": 2, "criterion": "Correct formula used"}, {"points": 1, "criterion": "Correct substitution"}]
    
    # AI-generated marking scheme (for papers without official MS)
    ai_generated_marking = models.BooleanField(default=False)
    marking_confidence = models.FloatField(null=True, blank=True)  # 0-1 confidence score
    
    # Topic tagging
    topics = models.ManyToManyField(Topic, related_name='questions', blank=True)
    
    # Difficulty (calculated)
    difficulty_score = models.FloatField(null=True, blank=True)  # 0-1 based on student performance
    
    # Flags
    needs_review = models.BooleanField(default=False)
    review_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order']
```

---

### User & Institution Models

#### 7. User Model (Extended)
```python
class User(AbstractUser):
    """
    Extended user model for students, teachers, parents, and admins.
    """
    class UserType(models.TextChoices):
        STUDENT = 'student', 'Student'
        TEACHER = 'teacher', 'Teacher'
        PARENT = 'parent', 'Parent'
        SCHOOL_ADMIN = 'school_admin', 'School Administrator'
        CONTENT_ADMIN = 'content_admin', 'Content Administrator'
        SUPER_ADMIN = 'super_admin', 'Super Administrator'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_type = models.CharField(max_length=20, choices=UserType.choices, default=UserType.STUDENT)
    
    # Profile
    phone_number = models.CharField(max_length=20, blank=True)
    whatsapp_number = models.CharField(max_length=20, blank=True)  # For notifications
    date_of_birth = models.DateField(null=True, blank=True)
    avatar = models.ImageField(upload_to='users/avatars/', null=True, blank=True)
    
    # Student-specific
    current_form = models.PositiveSmallIntegerField(null=True, blank=True)  # Form 1-6
    school = models.ForeignKey('School', on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    
    # Preferences
    preferred_subjects = models.ManyToManyField(Subject, blank=True)
    preferred_board = models.ForeignKey(ExaminationBoard, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Notification preferences
    email_notifications = models.BooleanField(default=True)
    whatsapp_notifications = models.BooleanField(default=True)
    
    # Subscription
    is_premium = models.BooleanField(default=False)
    premium_expires_at = models.DateTimeField(null=True, blank=True)
    
    # Stats (denormalized for performance)
    total_questions_attempted = models.PositiveIntegerField(default=0)
    total_marks_earned = models.PositiveIntegerField(default=0)
    total_marks_possible = models.PositiveIntegerField(default=0)
    current_streak_days = models.PositiveIntegerField(default=0)
    longest_streak_days = models.PositiveIntegerField(default=0)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['school', 'current_form']),
            models.Index(fields=['user_type', 'is_active']),
        ]
```

#### 8. School
```python
class School(models.Model):
    """
    Schools/institutions for B2B features.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    
    # Location
    province = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    
    # Contact
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    
    # Type
    class SchoolType(models.TextChoices):
        GOVERNMENT = 'government', 'Government'
        PRIVATE = 'private', 'Private'
        MISSION = 'mission', 'Mission'
        TRUST = 'trust', 'Trust'

    school_type = models.CharField(max_length=20, choices=SchoolType.choices)
    
    # Branding (for enterprise)
    logo = models.ImageField(upload_to='schools/logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#3B82F6')
    
    # Subscription
    subscription = models.ForeignKey('Subscription', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Settings
    default_board = models.ForeignKey(ExaminationBoard, on_delete=models.SET_NULL, null=True, blank=True)
    parent_portal_enabled = models.BooleanField(default=False)
    
    # Status
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    # Stats (denormalized)
    total_students = models.PositiveIntegerField(default=0)
    total_teachers = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
```

#### 9. TeacherProfile
```python
class TeacherProfile(models.Model):
    """
    Extended profile for teachers with school-specific information.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='teachers')
    
    # Professional info
    employee_id = models.CharField(max_length=50, blank=True)  # School's internal ID
    department = models.CharField(max_length=100, blank=True)  # "Sciences", "Languages"
    
    # Subjects they teach
    subjects = models.ManyToManyField(Subject, related_name='teachers')
    
    # Role
    class TeacherRole(models.TextChoices):
        TEACHER = 'teacher', 'Teacher'
        HOD = 'hod', 'Head of Department'
        DEPUTY = 'deputy', 'Deputy Head'
        HEAD = 'head', 'Headmaster/Headmistress'

    role = models.CharField(max_length=20, choices=TeacherRole.choices, default=TeacherRole.TEACHER)
    
    # Permissions
    can_create_assignments = models.BooleanField(default=True)
    can_view_school_analytics = models.BooleanField(default=False)
    can_manage_teachers = models.BooleanField(default=False)
    can_manage_students = models.BooleanField(default=False)
    
    is_active = models.BooleanField(default=True)
    joined_school_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'school']
```

#### 10. Class
```python
class Class(models.Model):
    """
    Represents a class/group of students taught by a teacher.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classes')
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name='classes')
    
    # Class identification
    name = models.CharField(max_length=100)  # "Form 4A", "Upper 6 Science", "O-Level Math Group 2"
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    form_level = models.PositiveSmallIntegerField()  # 1-6
    
    # Academic period
    academic_year = models.PositiveIntegerField()  # 2024
    term = models.PositiveSmallIntegerField(null=True, blank=True)  # 1, 2, 3
    
    # Students
    students = models.ManyToManyField(User, related_name='enrolled_classes', blank=True)
    max_students = models.PositiveIntegerField(default=50)
    
    # Join settings
    join_code = models.CharField(max_length=8, unique=True, blank=True)  # For students to join
    allow_join = models.BooleanField(default=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Classes'
        ordering = ['-academic_year', 'form_level', 'name']
        indexes = [
            models.Index(fields=['school', 'academic_year', 'is_active']),
        ]

    def save(self, *args, **kwargs):
        if not self.join_code:
            self.join_code = self._generate_join_code()
        super().save(*args, **kwargs)
    
    def _generate_join_code(self):
        import random
        import string
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
```

#### 11. Assignment
```python
class Assignment(models.Model):
    """
    Teacher-created assignments for classes.
    """
    class AssignmentType(models.TextChoices):
        PAPER = 'paper', 'Full Paper'
        TOPICS = 'topics', 'Topic Practice'
        CUSTOM = 'custom', 'Custom Questions'
        QUIZ = 'quiz', 'Quick Quiz'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name='assignments')
    
    # Can be assigned to one or more classes
    classes = models.ManyToManyField(Class, related_name='assignments')
    
    # Assignment details
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assignment_type = models.CharField(max_length=20, choices=AssignmentType.choices)
    
    # Content
    papers = models.ManyToManyField(Paper, blank=True)  # For paper-based assignments
    topics = models.ManyToManyField(Topic, blank=True)  # For topic-based assignments
    questions = models.ManyToManyField(Question, blank=True)  # For custom assignments
    
    # Settings
    total_marks = models.PositiveIntegerField(default=0)
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)  # Optional time limit
    attempts_allowed = models.PositiveSmallIntegerField(default=1)  # 0 = unlimited
    show_answers_after = models.BooleanField(default=True)  # Show correct answers after submission
    
    # Scheduling
    available_from = models.DateTimeField()
    due_date = models.DateTimeField()
    late_submission_allowed = models.BooleanField(default=False)
    late_penalty_percent = models.PositiveSmallIntegerField(default=0)  # % deducted for late
    
    # Status
    is_published = models.BooleanField(default=False)
    is_mandatory = models.BooleanField(default=True)
    
    # Notifications
    notify_on_publish = models.BooleanField(default=True)
    remind_before_due = models.BooleanField(default=True)
    notify_parents = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-due_date']
        indexes = [
            models.Index(fields=['due_date', 'is_published']),
        ]
```

#### 12. AssignmentSubmission
```python
class AssignmentSubmission(models.Model):
    """
    Student's submission for an assignment.
    """
    class Status(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        SUBMITTED = 'submitted', 'Submitted'
        LATE = 'late', 'Submitted Late'
        GRADED = 'graded', 'Graded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignment_submissions')
    attempt = models.ForeignKey('Attempt', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Status tracking
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    attempt_number = models.PositiveSmallIntegerField(default=1)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    # Results
    marks_earned = models.PositiveIntegerField(default=0)
    marks_possible = models.PositiveIntegerField(default=0)
    percentage_score = models.FloatField(null=True, blank=True)
    final_score = models.FloatField(null=True, blank=True)  # After any penalties
    
    # Teacher feedback
    teacher_feedback = models.TextField(blank=True)
    graded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='graded_submissions')
    graded_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['assignment', 'student', 'attempt_number']
        ordering = ['-submitted_at']
```

#### 13. ParentLink
```python
class ParentLink(models.Model):
    """
    Links parents to their children for progress visibility.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='children_links')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='parent_links')
    
    # Relationship
    class Relationship(models.TextChoices):
        FATHER = 'father', 'Father'
        MOTHER = 'mother', 'Mother'
        GUARDIAN = 'guardian', 'Guardian'
        OTHER = 'other', 'Other'

    relationship = models.CharField(max_length=20, choices=Relationship.choices)
    
    # Verification
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_parent_links')
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Notification preferences
    receive_weekly_report = models.BooleanField(default=True)
    receive_assignment_alerts = models.BooleanField(default=True)
    receive_performance_alerts = models.BooleanField(default=True)  # e.g., score dropped significantly
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['parent', 'student']
```

#### 14. Subscription
```python
class Subscription(models.Model):
    """
    Subscription management for premium features.
    """
    class Plan(models.TextChoices):
        FREE = 'free', 'Free'
        STUDENT_PREMIUM = 'student_premium', 'Student Premium'
        TEACHER = 'teacher', 'Teacher'
        SCHOOL_BASIC = 'school_basic', 'School Basic'
        SCHOOL_PRO = 'school_pro', 'School Pro'
        SCHOOL_ENTERPRISE = 'school_enterprise', 'School Enterprise'
        DISTRICT = 'district', 'District'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAST_DUE = 'past_due', 'Past Due'
        CANCELLED = 'cancelled', 'Cancelled'
        EXPIRED = 'expired', 'Expired'
        TRIAL = 'trial', 'Trial'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    
    # Owner (either user or school)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='subscriptions')
    school = models.ForeignKey(School, on_delete=models.CASCADE, null=True, blank=True, related_name='subscriptions')
    
    plan = models.CharField(max_length=30, choices=Plan.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIAL)
    
    # Limits
    max_students = models.PositiveIntegerField(default=0)  # 0 = unlimited
    max_teachers = models.PositiveIntegerField(default=0)
    max_papers_per_month = models.PositiveIntegerField(default=10)
    
    # Features
    ai_marking_enabled = models.BooleanField(default=True)
    parent_portal_enabled = models.BooleanField(default=False)
    advanced_analytics_enabled = models.BooleanField(default=False)
    api_access_enabled = models.BooleanField(default=False)
    custom_branding_enabled = models.BooleanField(default=False)
    
    # Billing
    amount_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=3, default='USD')
    billing_cycle = models.CharField(max_length=20, default='monthly')  # monthly, termly, yearly
    
    # Dates
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    # Payment reference
    payment_provider = models.CharField(max_length=50, blank=True)  # 'paynow', 'ecocash', 'stripe'
    external_id = models.CharField(max_length=100, blank=True)  # Provider's subscription ID
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
```

---

### Student Activity Models

#### 15. Attempt
```python
class Attempt(models.Model):
    """
    Records a student's attempt at a paper or set of questions.
    """
    class AttemptMode(models.TextChoices):
        EXAM = 'exam', 'Exam Mode'  # Timed, full paper
        PRACTICE = 'practice', 'Practice Mode'  # Untimed, with hints
        TOPIC = 'topic', 'Topic Practice'  # Questions from specific topics
        QUICK = 'quick', 'Quick Quiz'  # Random questions
        ASSIGNMENT = 'assignment', 'Assignment'  # Teacher-assigned

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attempts')
    paper = models.ForeignKey(Paper, on_delete=models.CASCADE, null=True, blank=True)
    assignment = models.ForeignKey(Assignment, on_delete=models.SET_NULL, null=True, blank=True)
    
    mode = models.CharField(max_length=20, choices=AttemptMode.choices)
    
    # Timing
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    
    # Results
    total_marks_earned = models.PositiveIntegerField(default=0)
    total_marks_possible = models.PositiveIntegerField(default=0)
    percentage_score = models.FloatField(null=True, blank=True)
    
    # Status
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        ABANDONED = 'abandoned', 'Abandoned'

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    
    # For topic-based practice
    topics = models.ManyToManyField(Topic, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', 'status', 'started_at']),
        ]
```

#### 16. Answer
```python
class Answer(models.Model):
    """
    Individual answer to a question within an attempt.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='student_answers')
    
    # Answer content
    answer_text = models.TextField(blank=True)
    selected_option = models.CharField(max_length=5, blank=True)  # For MCQ
    answer_image = models.ImageField(upload_to='answers/images/', null=True, blank=True)  # Photo of handwritten
    
    # Marking
    marks_awarded = models.PositiveIntegerField(default=0)
    is_correct = models.BooleanField(null=True)  # For MCQ
    
    # AI Feedback
    ai_feedback = models.TextField(blank=True)
    ai_marking_breakdown = models.JSONField(default=list)
    # [{"criterion": "...", "awarded": 1, "max": 2, "feedback": "..."}]
    
    ai_confidence = models.FloatField(null=True, blank=True)
    
    # Manual override (for teachers/admins)
    manually_marked = models.BooleanField(default=False)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Timestamps
    answered_at = models.DateTimeField(auto_now_add=True)
    marked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['attempt', 'question']
```

#### 17. TopicProgress
```python
class TopicProgress(models.Model):
    """
    Tracks a student's progress and mastery of each topic.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='topic_progress')
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    
    questions_attempted = models.PositiveIntegerField(default=0)
    questions_correct = models.PositiveIntegerField(default=0)
    total_marks_earned = models.PositiveIntegerField(default=0)
    total_marks_possible = models.PositiveIntegerField(default=0)
    
    # Mastery level
    class MasteryLevel(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        BEGINNER = 'beginner', 'Beginner'
        DEVELOPING = 'developing', 'Developing'
        PROFICIENT = 'proficient', 'Proficient'
        MASTERED = 'mastered', 'Mastered'

    mastery_level = models.CharField(max_length=20, choices=MasteryLevel.choices, default=MasteryLevel.NOT_STARTED)
    mastery_score = models.FloatField(default=0)  # 0-100
    
    last_practiced_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['user', 'topic']
```

#### 18. StudySession
```python
class StudySession(models.Model):
    """
    Tracks daily study activity for gamification and analytics.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_sessions')
    date = models.DateField()
    
    time_spent_seconds = models.PositiveIntegerField(default=0)
    questions_attempted = models.PositiveIntegerField(default=0)
    questions_correct = models.PositiveIntegerField(default=0)
    
    # Streak tracking
    streak_maintained = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['user', 'date']
```

#### 19. Bookmark
```python
class Bookmark(models.Model):
    """
    Allows students to save questions for later review.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    
    note = models.TextField(blank=True)  # Personal note
    folder = models.CharField(max_length=100, default='default')  # Custom folders
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'question']
```

#### 20. AIMarkingLog
```python
class AIMarkingLog(models.Model):
    """
    Logs all AI marking requests for auditing, debugging, and cost tracking.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name='marking_logs')
    
    # Request
    prompt_sent = models.TextField()
    model_used = models.CharField(max_length=50)
    
    # Response
    response_received = models.TextField()
    tokens_used = models.PositiveIntegerField()
    latency_ms = models.PositiveIntegerField()
    
    # Result
    marks_awarded = models.PositiveIntegerField()
    confidence_score = models.FloatField()
    
    created_at = models.DateTimeField(auto_now_add=True)
```

---

### Notification Models

#### 21. Notification
```python
class Notification(models.Model):
    """
    In-app and push notifications.
    """
    class NotificationType(models.TextChoices):
        ASSIGNMENT_NEW = 'assignment_new', 'New Assignment'
        ASSIGNMENT_DUE = 'assignment_due', 'Assignment Due Soon'
        ASSIGNMENT_GRADED = 'assignment_graded', 'Assignment Graded'
        STREAK_REMINDER = 'streak_reminder', 'Streak Reminder'
        ACHIEVEMENT = 'achievement', 'Achievement Unlocked'
        PARENT_REPORT = 'parent_report', 'Weekly Report'
        SYSTEM = 'system', 'System Notification'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Related objects
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, null=True, blank=True)
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Delivery
    sent_via_email = models.BooleanField(default=False)
    sent_via_whatsapp = models.BooleanField(default=False)
    sent_via_push = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```

#### 22. WhatsAppMessage
```python
class WhatsAppMessage(models.Model):
    """
    Track WhatsApp messages sent (for debugging and compliance).
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        DELIVERED = 'delivered', 'Delivered'
        READ = 'read', 'Read'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='whatsapp_messages')
    phone_number = models.CharField(max_length=20)
    
    template_name = models.CharField(max_length=100)  # WhatsApp template ID
    template_params = models.JSONField(default=dict)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    provider_message_id = models.CharField(max_length=100, blank=True)
    error_message = models.TextField(blank=True)
    
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## Backend Modules (DRF)

### App Structure
```
backend/
├── config/                 # Project settings
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   ├── production.py
│   │   └── testing.py
│   ├── urls.py
│   ├── celery.py
│   └── wsgi.py
├── apps/
│   ├── users/              # User management
│   ├── schools/            # School & institution management
│   ├── teachers/           # Teacher-specific features
│   ├── exams/              # Core exam/paper/question models
│   ├── attempts/           # Student attempts and answers
│   ├── assignments/        # Teacher assignments
│   ├── progress/           # Progress tracking and analytics
│   ├── ai_marking/         # AI integration for marking
│   ├── pdf_processor/      # PDF extraction pipeline
│   ├── notifications/      # Push, email, WhatsApp notifications
│   ├── subscriptions/      # Billing and plans
│   └── reports/            # Analytics and reporting
├── core/                   # Shared utilities
│   ├── permissions.py
│   ├── pagination.py
│   ├── exceptions.py
│   └── mixins.py
└── manage.py
```

### API Endpoints

#### Authentication (`/api/v1/auth/`)
```
POST   /register/                  # Student/Parent/Teacher registration
POST   /register/school-admin/     # School admin registration (creates school)
POST   /login/                     # JWT login
POST   /logout/                    # Logout (blacklist token)
POST   /token/refresh/             # Refresh JWT
POST   /password/reset/            # Request password reset
POST   /password/reset/confirm/    # Confirm password reset
GET    /me/                        # Current user profile
PATCH  /me/                        # Update profile
POST   /verify-phone/              # Phone verification (for ZW users)
```

#### Examination Boards (`/api/v1/boards/`)
```
GET    /                           # List all boards
GET    /{id}/                      # Board details
GET    /{id}/subjects/             # Subjects for this board
GET    /{id}/syllabi/              # All syllabi for this board
```

#### Subjects (`/api/v1/subjects/`)
```
GET    /                           # List all subjects
GET    /{slug}/                    # Subject details
GET    /{slug}/syllabi/            # Syllabi for this subject
```

#### Syllabi (`/api/v1/syllabi/`)
```
GET    /                           # List with filters (board, subject, level)
GET    /{id}/                      # Syllabus details with topics
GET    /{id}/topics/               # Topic tree for syllabus
GET    /{id}/papers/               # Papers for this syllabus
```

#### Papers (`/api/v1/papers/`)
```
GET    /                           # List papers with filters
GET    /{id}/                      # Paper details
GET    /{id}/questions/            # Questions for paper
GET    /{id}/pdf/                  # Stream PDF file
POST   /{id}/start-attempt/        # Start a new attempt
```

#### Questions (`/api/v1/questions/`)
```
GET    /                           # List with filters (topic, type, difficulty)
GET    /{id}/                      # Question details
GET    /{id}/diagram/              # Get diagram image
GET    /random/                    # Random questions for quick quiz
GET    /by-topic/{topic_id}/       # Questions for specific topic
```

#### Attempts (`/api/v1/attempts/`)
```
GET    /                           # User's attempts history
POST   /                           # Create new attempt (topic/quick mode)
GET    /{id}/                      # Attempt details
PATCH  /{id}/                      # Update attempt (time tracking)
POST   /{id}/complete/             # Mark attempt complete
GET    /{id}/results/              # Detailed results with feedback
```

#### Answers (`/api/v1/answers/`)
```
POST   /                           # Submit answer
GET    /{id}/                      # Answer with feedback
POST   /{id}/request-remark/       # Request AI re-marking
```

#### Progress (`/api/v1/progress/`)
```
GET    /dashboard/                 # Overall progress dashboard
GET    /topics/                    # Progress by topic
GET    /subjects/                  # Progress by subject
GET    /history/                   # Activity history
GET    /streaks/                   # Study streaks
GET    /weak-areas/                # AI-identified weak areas
GET    /recommendations/           # Suggested topics/papers to practice
```

#### Bookmarks (`/api/v1/bookmarks/`)
```
GET    /                           # List bookmarks
POST   /                           # Add bookmark
DELETE /{id}/                      # Remove bookmark
GET    /folders/                   # List bookmark folders
```

---

### Teacher Endpoints (`/api/v1/teacher/`)

```
# Classes
GET    /classes/                           # List teacher's classes
POST   /classes/                           # Create new class
GET    /classes/{id}/                      # Class details
PATCH  /classes/{id}/                      # Update class
DELETE /classes/{id}/                      # Archive class
POST   /classes/{id}/regenerate-code/      # Generate new join code
GET    /classes/{id}/students/             # List students in class
POST   /classes/{id}/add-student/          # Manually add student
DELETE /classes/{id}/students/{user_id}/   # Remove student from class

# Class Analytics
GET    /classes/{id}/analytics/            # Class performance overview
GET    /classes/{id}/analytics/topics/     # Performance by topic
GET    /classes/{id}/analytics/trends/     # Performance over time
GET    /classes/{id}/weak-topics/          # Class-wide weak areas
GET    /classes/{id}/leaderboard/          # Top performing students

# Assignments
GET    /assignments/                       # List teacher's assignments
POST   /assignments/                       # Create new assignment
GET    /assignments/{id}/                  # Assignment details
PATCH  /assignments/{id}/                  # Update assignment
DELETE /assignments/{id}/                  # Delete assignment
POST   /assignments/{id}/publish/          # Publish assignment
POST   /assignments/{id}/duplicate/        # Duplicate assignment

# Assignment Monitoring
GET    /assignments/{id}/submissions/      # List all submissions
GET    /assignments/{id}/submissions/{student_id}/  # Student's submission
PATCH  /assignments/{id}/submissions/{student_id}/  # Add teacher feedback
GET    /assignments/{id}/analytics/        # Assignment performance stats
GET    /assignments/{id}/not-submitted/    # Students who haven't submitted

# Student Management
GET    /students/                          # All students across classes
GET    /students/{id}/                     # Individual student details
GET    /students/{id}/progress/            # Student's full progress
GET    /students/{id}/attempts/            # Student's attempt history
POST   /students/{id}/send-reminder/       # Send reminder notification

# Reports
GET    /reports/class-summary/             # Summary for all classes
GET    /reports/class/{id}/pdf/            # Generate PDF report for class
GET    /reports/student/{id}/pdf/          # Generate PDF report for student
```

---

### School Admin Endpoints (`/api/v1/school/`)

```
# School Management
GET    /profile/                           # School profile
PATCH  /profile/                           # Update school profile
POST   /profile/logo/                      # Upload school logo

# Teacher Management
GET    /teachers/                          # List all teachers
POST   /teachers/invite/                   # Invite teacher (sends email)
GET    /teachers/{id}/                     # Teacher details
PATCH  /teachers/{id}/                     # Update teacher permissions
DELETE /teachers/{id}/                     # Remove teacher from school
GET    /teachers/{id}/classes/             # Teacher's classes
GET    /teachers/{id}/performance/         # Teacher effectiveness metrics

# Student Management
GET    /students/                          # List all students
POST   /students/bulk-upload/              # CSV upload of students
GET    /students/{id}/                     # Student details
GET    /students/unassigned/               # Students not in any class

# Class Overview
GET    /classes/                           # All classes in school
GET    /classes/by-form/{form}/            # Classes by form level
GET    /classes/comparison/                # Compare class performance

# Analytics Dashboard
GET    /analytics/overview/                # School-wide metrics
GET    /analytics/subjects/                # Performance by subject
GET    /analytics/forms/                   # Performance by form level
GET    /analytics/trends/                  # Performance over time
GET    /analytics/engagement/              # Usage and engagement metrics
GET    /analytics/top-students/            # School leaderboard

# Parent Portal (if enabled)
GET    /parents/                           # List parent accounts
GET    /parents/{id}/                      # Parent details with linked children
POST   /parents/verify-link/               # Verify parent-student link

# Subscription & Billing
GET    /subscription/                      # Current subscription details
GET    /subscription/usage/                # Usage vs limits
POST   /subscription/upgrade/              # Request upgrade

# Reports
GET    /reports/summary/                   # School summary report
GET    /reports/by-department/             # Department breakdown
GET    /reports/export/                    # Export data (CSV/Excel)
```

---

### Parent Endpoints (`/api/v1/parent/`)

```
# Children
GET    /children/                          # List linked children
POST   /children/link/                     # Request to link child (needs verification)
DELETE /children/{id}/                     # Unlink child

# Child Progress
GET    /children/{id}/dashboard/           # Child's progress overview
GET    /children/{id}/subjects/            # Performance by subject
GET    /children/{id}/recent-activity/     # Recent practice sessions
GET    /children/{id}/assignments/         # Child's assignments
GET    /children/{id}/weak-areas/          # Areas needing attention

# Reports
GET    /reports/weekly/                    # Weekly summary for all children
GET    /reports/child/{id}/                # Detailed report for one child

# Settings
GET    /notification-settings/             # Notification preferences
PATCH  /notification-settings/             # Update preferences
```

---

### Admin/Content Management (`/api/v1/admin/`)

```
# Paper management
POST   /papers/upload/                     # Upload new paper PDF
GET    /papers/pending/                    # Papers pending processing
POST   /papers/{id}/process/               # Trigger PDF processing
PATCH  /papers/{id}/review/                # Mark review complete

# Question management  
GET    /questions/review/                  # Questions needing review
PATCH  /questions/{id}/                    # Update question
POST   /questions/{id}/approve/            # Approve question

# Bulk operations
POST   /bulk/upload/                       # Bulk PDF upload
GET    /bulk/status/{job_id}/              # Check bulk job status

# School management
GET    /schools/                           # List all schools
GET    /schools/{id}/                      # School details
PATCH  /schools/{id}/verify/               # Verify school
GET    /schools/pending-verification/      # Schools awaiting verification
```

---

## Frontend Modules (React)

### Project Structure
```
frontend/
├── src/
│   ├── app/                    # App setup, providers, router
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── layout/             # Layout components
│   │   ├── forms/              # Form components
│   │   └── features/           # Feature-specific components
│   ├── features/               # Feature modules
│   │   ├── auth/
│   │   ├── papers/
│   │   ├── questions/
│   │   ├── attempts/
│   │   ├── progress/
│   │   ├── bookmarks/
│   │   ├── teacher/            # Teacher dashboard
│   │   ├── school/             # School admin dashboard
│   │   └── parent/             # Parent portal
│   ├── hooks/                  # Custom hooks
│   ├── lib/                    # Utilities, API client
│   ├── stores/                 # Zustand stores
│   ├── styles/                 # Global styles
│   └── types/                  # TypeScript types
├── public/
└── index.html
```

### Pages/Routes

#### Student Routes
```
/                               # Landing page
/login                          # Login
/register                       # Registration
/dashboard                      # Student dashboard
/subjects                       # Browse subjects
/subjects/:slug                 # Subject detail with papers
/papers                         # Browse all papers
/papers/:id                     # Paper detail
/papers/:id/attempt             # Take paper (exam mode)
/papers/:id/practice            # Practice paper
/papers/:id/results/:attemptId  # View results
/questions                      # Question bank
/questions/quiz                 # Quick quiz
/topics/:id/practice            # Topic practice
/progress                       # Progress dashboard
/bookmarks                      # Saved questions
/assignments                    # My assignments (student view)
/assignments/:id                # Assignment detail
/settings                       # User settings
```

#### Teacher Routes
```
/teacher                        # Teacher dashboard home
/teacher/classes                # All classes
/teacher/classes/new            # Create class
/teacher/classes/:id            # Class detail
/teacher/classes/:id/students   # Class students
/teacher/classes/:id/analytics  # Class analytics
/teacher/assignments            # All assignments
/teacher/assignments/new        # Create assignment
/teacher/assignments/:id        # Assignment detail
/teacher/assignments/:id/submissions  # View submissions
/teacher/students/:id           # Individual student view
/teacher/reports                # Generate reports
```

#### School Admin Routes
```
/school                         # School admin dashboard
/school/teachers                # Manage teachers
/school/teachers/:id            # Teacher detail
/school/students                # All students
/school/classes                 # All classes overview
/school/analytics               # School-wide analytics
/school/analytics/subjects      # By subject
/school/analytics/forms         # By form level
/school/parents                 # Parent accounts (if enabled)
/school/subscription            # Subscription & billing
/school/settings                # School settings
```

#### Parent Routes
```
/parent                         # Parent dashboard
/parent/children                # Linked children
/parent/children/:id            # Child detail
/parent/children/:id/progress   # Child progress
/parent/reports                 # Weekly reports
/parent/settings                # Notification settings
```

### Key Components

#### Teacher Dashboard Components
```
TeacherDashboard       # Overview with quick stats
ClassCard              # Class preview card
ClassList              # List of classes
ClassDetail            # Full class view
StudentTable           # Sortable student list with scores
StudentProgressCard    # Individual student snapshot
AssignmentBuilder      # Create/edit assignment form
AssignmentCard         # Assignment preview
SubmissionsList        # Assignment submissions table
SubmissionDetail       # Individual submission review
ClassAnalyticsChart    # Performance visualizations
TopicHeatmap           # Topic mastery across class
WeakTopicsAlert        # Highlight struggling areas
CompareClassesChart    # Compare multiple classes
StudentActivityFeed    # Recent student activity
BulkActionBar          # Bulk operations on students
```

#### School Admin Components
```
SchoolDashboard        # High-level school metrics
TeacherList            # All teachers with stats
TeacherPerformanceCard # Teacher effectiveness metrics
SchoolAnalyticsGrid    # Key metrics grid
DepartmentComparison   # Compare departments
FormLevelComparison    # Compare form levels
EngagementChart        # Usage over time
SubscriptionStatus     # Plan details and usage
ParentsList            # Parent accounts management
VerificationQueue      # Pending verifications
ExportReportModal      # Export options
```

#### Parent Portal Components
```
ParentDashboard        # Overview of all children
ChildCard              # Child summary card
ChildProgressView      # Detailed progress for one child
WeeklyReportCard       # Weekly summary
AssignmentStatusList   # Pending/completed assignments
PerformanceAlert       # Alerts for concerning trends
NotificationSettings   # Manage notification preferences
```

### State Management (Zustand)

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  userType: 'student' | 'teacher' | 'parent' | 'school_admin' | null;
  login: (credentials) => Promise<void>;
  logout: () => void;
  updateProfile: (data) => Promise<void>;
}

// stores/teacherStore.ts
interface TeacherState {
  classes: Class[];
  selectedClass: Class | null;
  assignments: Assignment[];
  loadClasses: () => Promise<void>;
  selectClass: (classId: string) => void;
  createAssignment: (data: AssignmentInput) => Promise<void>;
  getClassAnalytics: (classId: string) => Promise<ClassAnalytics>;
}

// stores/schoolStore.ts
interface SchoolState {
  school: School | null;
  teachers: TeacherProfile[];
  subscription: Subscription | null;
  analytics: SchoolAnalytics | null;
  loadSchoolData: () => Promise<void>;
  inviteTeacher: (email: string) => Promise<void>;
  loadAnalytics: (filters: AnalyticsFilters) => Promise<void>;
}

// stores/attemptStore.ts
interface AttemptState {
  currentAttempt: Attempt | null;
  answers: Record<string, Answer>;
  timeRemaining: number;
  startAttempt: (paperId: string, mode: AttemptMode) => Promise<void>;
  submitAnswer: (questionId: string, answer: AnswerInput) => Promise<void>;
  completeAttempt: () => Promise<void>;
}

// stores/uiStore.ts
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme) => void;
}
```

---

## Notification System

### WhatsApp Integration

Use WhatsApp Business API (via Twilio or 360dialog) for critical notifications. WhatsApp has higher open rates than email in Zimbabwe.

#### Message Templates (must be pre-approved by WhatsApp)

```python
# apps/notifications/templates.py

WHATSAPP_TEMPLATES = {
    'assignment_new': {
        'name': 'assignment_notification',
        'language': 'en',
        'components': [
            {'type': 'body', 'parameters': [
                {'type': 'text', 'text': '{{student_name}}'},
                {'type': 'text', 'text': '{{assignment_title}}'},
                {'type': 'text', 'text': '{{subject}}'},
                {'type': 'text', 'text': '{{due_date}}'},
            ]}
        ]
    },
    'assignment_reminder': {
        'name': 'assignment_due_reminder',
        'language': 'en',
        # ...
    },
    'weekly_parent_report': {
        'name': 'parent_weekly_summary',
        'language': 'en',
        'components': [
            {'type': 'body', 'parameters': [
                {'type': 'text', 'text': '{{child_name}}'},
                {'type': 'text', 'text': '{{questions_practiced}}'},
                {'type': 'text', 'text': '{{average_score}}'},
                {'type': 'text', 'text': '{{streak_days}}'},
            ]}
        ]
    },
    'performance_alert': {
        'name': 'performance_concern_alert',
        'language': 'en',
        # Alert parents when score drops significantly
    },
}
```

#### Notification Service

```python
# apps/notifications/services.py

class NotificationService:
    def __init__(self):
        self.whatsapp_client = WhatsAppClient()
        self.email_client = EmailClient()
    
    async def notify_new_assignment(self, assignment: Assignment):
        """Notify all students in the assignment's classes."""
        students = User.objects.filter(
            enrolled_classes__in=assignment.classes.all()
        ).distinct()
        
        for student in students:
            # In-app notification
            await self.create_notification(
                user=student,
                notification_type='assignment_new',
                title=f'New Assignment: {assignment.title}',
                message=f'Due {assignment.due_date.strftime("%d %b")}',
                assignment=assignment
            )
            
            # WhatsApp (if enabled)
            if student.whatsapp_notifications and student.whatsapp_number:
                await self.whatsapp_client.send_template(
                    to=student.whatsapp_number,
                    template='assignment_new',
                    params={
                        'student_name': student.first_name,
                        'assignment_title': assignment.title,
                        'subject': assignment.classes.first().subject.name,
                        'due_date': assignment.due_date.strftime('%d %B'),
                    }
                )
        
        # Notify parents if enabled
        if assignment.notify_parents:
            await self._notify_parents_of_assignment(assignment)
    
    async def send_weekly_parent_reports(self):
        """Send weekly summary to all parents. Run via Celery beat."""
        parent_links = ParentLink.objects.filter(
            receive_weekly_report=True,
            parent__whatsapp_notifications=True
        ).select_related('parent', 'student')
        
        for link in parent_links:
            # Calculate weekly stats
            stats = await self._calculate_weekly_stats(link.student)
            
            await self.whatsapp_client.send_template(
                to=link.parent.whatsapp_number,
                template='weekly_parent_report',
                params={
                    'child_name': link.student.first_name,
                    'questions_practiced': stats['questions'],
                    'average_score': f"{stats['avg_score']}%",
                    'streak_days': stats['streak'],
                }
            )
```

#### Celery Tasks for Scheduled Notifications

```python
# apps/notifications/tasks.py

from celery import shared_task
from celery.schedules import crontab

@shared_task
def send_assignment_reminders():
    """Send reminders for assignments due tomorrow. Run daily at 6 PM."""
    tomorrow = timezone.now().date() + timedelta(days=1)
    
    assignments = Assignment.objects.filter(
        due_date__date=tomorrow,
        is_published=True,
        remind_before_due=True
    )
    
    notification_service = NotificationService()
    
    for assignment in assignments:
        # Get students who haven't submitted
        pending_students = get_students_without_submission(assignment)
        
        for student in pending_students:
            asyncio.run(notification_service.send_assignment_reminder(
                student=student,
                assignment=assignment
            ))

@shared_task
def send_weekly_parent_reports():
    """Send weekly reports to parents. Run every Sunday at 6 PM."""
    notification_service = NotificationService()
    asyncio.run(notification_service.send_weekly_parent_reports())

@shared_task
def send_streak_reminders():
    """Remind students to maintain their streak. Run daily at 5 PM."""
    # Students who practiced yesterday but not today
    yesterday = timezone.now().date() - timedelta(days=1)
    
    active_students = User.objects.filter(
        study_sessions__date=yesterday,
        current_streak_days__gt=0
    ).exclude(
        study_sessions__date=timezone.now().date()
    )
    
    # Send gentle reminder
    for student in active_students:
        # ...

# Celery beat schedule
CELERY_BEAT_SCHEDULE = {
    'assignment-reminders': {
        'task': 'notifications.tasks.send_assignment_reminders',
        'schedule': crontab(hour=18, minute=0),
    },
    'weekly-parent-reports': {
        'task': 'notifications.tasks.send_weekly_parent_reports',
        'schedule': crontab(day_of_week=0, hour=18, minute=0),  # Sunday 6 PM
    },
    'streak-reminders': {
        'task': 'notifications.tasks.send_streak_reminders',
        'schedule': crontab(hour=17, minute=0),
    },
}
```

---

## AI Integration Module

### Marking Service

```python
# apps/ai_marking/services.py

class AIMarkingService:
    """
    Handles all AI-powered marking and feedback generation.
    """
    
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.model = "claude-sonnet-4-20250514"
    
    async def mark_answer(
        self,
        question: Question,
        student_answer: str,
        marking_scheme: Optional[List[dict]] = None
    ) -> MarkingResult:
        """
        Mark a student's answer using AI.
        
        Returns:
            MarkingResult with marks, feedback, and breakdown
        """
        
        # Build context-aware prompt
        prompt = self._build_marking_prompt(
            question=question,
            student_answer=student_answer,
            marking_scheme=marking_scheme
        )
        
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
            system=self._get_marking_system_prompt(question.question_type)
        )
        
        # Parse structured response
        return self._parse_marking_response(response, question.marks)
    
    def _build_marking_prompt(self, question, student_answer, marking_scheme):
        """Build the marking prompt with all relevant context."""
        
        prompt = f"""
## Question
{question.question_text}

## Maximum Marks: {question.marks}

## Student's Answer
{student_answer}

"""
        
        if marking_scheme:
            prompt += f"""
## Official Marking Scheme
{json.dumps(marking_scheme, indent=2)}
"""
        elif question.model_answer:
            prompt += f"""
## Model Answer
{question.model_answer}
"""
        
        prompt += """
## Your Task
1. Evaluate the student's answer against the marking criteria
2. Award marks fairly and consistently
3. Provide specific, constructive feedback
4. Identify what was done well and what could be improved

Respond in the following JSON format:
{
    "marks_awarded": <number>,
    "breakdown": [
        {
            "criterion": "<marking point>",
            "marks_possible": <number>,
            "marks_awarded": <number>,
            "feedback": "<specific feedback>"
        }
    ],
    "overall_feedback": "<2-3 sentences of constructive feedback>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "improvements": ["<improvement 1>", "<improvement 2>"],
    "confidence": <0.0-1.0>
}
"""
        return prompt
    
    def _get_marking_system_prompt(self, question_type: str) -> str:
        """Get type-specific system prompt."""
        
        base = """You are an experienced examiner marking student answers for 
Zimbabwe secondary school examinations (ZIMSEC/Cambridge). Mark fairly but 
rigorously, following official marking conventions.

Key principles:
- Award marks for correct content, not presentation
- Accept alternative correct answers
- Partial marks for partially correct answers
- Clear, encouraging feedback that helps students improve
- Be consistent with mark allocation
"""
        
        type_specific = {
            'mcq': "For multiple choice, simply verify if the selected option is correct.",
            'calculation': "Check the method as well as the final answer. Award method marks even if the final answer is wrong due to arithmetic errors.",
            'essay': "Assess content, structure, and argument quality. Look for relevant examples and evidence.",
            'short': "Look for key terms and concepts. Accept synonyms and alternative phrasings.",
            'structured': "Mark each part separately. Later parts may depend on earlier answers - follow through where appropriate.",
        }
        
        return base + "\n" + type_specific.get(question_type, "")
```

### Marking Scheme Generator

```python
# apps/ai_marking/generators.py

class MarkingSchemeGenerator:
    """
    Generates marking schemes for papers without official ones.
    """
    
    async def generate_marking_scheme(
        self,
        question: Question,
        syllabus: Syllabus
    ) -> List[dict]:
        """
        Generate a marking scheme based on the question and syllabus context.
        """
        
        prompt = f"""
## Context
- Examination Board: {syllabus.board.name}
- Subject: {syllabus.subject.name}
- Level: {syllabus.level_name}

## Question ({question.marks} marks)
{question.question_text}

## Task
Generate a detailed marking scheme for this question. Consider:
1. What key points must be included for full marks?
2. How should partial marks be awarded?
3. What common alternative answers should be accepted?

Respond with a JSON array:
[
    {{
        "points": <marks for this criterion>,
        "criterion": "<what the student must include>",
        "alternatives": ["<alternative acceptable answers>"],
        "common_errors": ["<common mistakes to watch for>"]
    }}
]

The total points must equal {question.marks}.
"""
        
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return self._parse_and_validate(response, question.marks)
```

### Class Analytics Generator

```python
# apps/ai_marking/analytics.py

class ClassAnalyticsService:
    """
    AI-powered insights for teacher dashboards.
    """
    
    async def generate_class_insights(
        self,
        class_obj: Class,
        topic_performance: List[dict]
    ) -> ClassInsights:
        """
        Generate actionable insights for a teacher about their class.
        """
        
        prompt = f"""
## Class Information
- Subject: {class_obj.subject.name}
- Form Level: {class_obj.form_level}
- Number of Students: {class_obj.students.count()}

## Topic Performance Data
{json.dumps(topic_performance, indent=2)}

## Task
Analyze this class's performance and provide:
1. Top 3 areas of strength
2. Top 3 areas needing attention (with specific topics)
3. Recommended teaching focus for next week
4. Students who may need individual attention (based on patterns)
5. Suggested resources or practice papers

Be specific and actionable. This is for the teacher's use.
"""
        
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return self._parse_insights(response)
```

---

## PDF Processing Pipeline

### Extraction Service

```python
# apps/pdf_processor/services.py

import fitz  # PyMuPDF
from PIL import Image
import io

class PDFProcessor:
    """
    Extracts questions and diagrams from PDF papers.
    """
    
    def __init__(self):
        self.client = anthropic.Anthropic()
    
    async def process_paper(self, paper: Paper) -> ProcessingResult:
        """
        Full processing pipeline for a paper PDF.
        """
        
        # Open PDF
        pdf_document = fitz.open(paper.pdf_file.path)
        paper.pdf_page_count = len(pdf_document)
        
        # Render pages as images
        page_images = self._render_pages(pdf_document)
        
        # Extract questions using AI
        questions = await self._extract_questions(page_images, paper)
        
        # Extract and crop diagrams
        for question in questions:
            if question['has_diagram']:
                diagram_image = self._crop_diagram(
                    page_images[question['source_page'] - 1],
                    question['diagram_coords']
                )
                question['diagram_image'] = diagram_image
        
        # Save to database
        self._save_questions(paper, questions)
        
        return ProcessingResult(
            questions_extracted=len(questions),
            diagrams_found=sum(1 for q in questions if q['has_diagram']),
            needs_review=[q for q in questions if q.get('confidence', 1) < 0.8]
        )
    
    def _render_pages(self, pdf_document, dpi=300) -> List[Image.Image]:
        """Render PDF pages as high-resolution images."""
        
        images = []
        for page in pdf_document:
            mat = fitz.Matrix(dpi/72, dpi/72)
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
        return images
    
    async def _extract_questions(
        self,
        page_images: List[Image.Image],
        paper: Paper
    ) -> List[dict]:
        """Use AI to extract questions from page images."""
        
        all_questions = []
        
        for page_num, image in enumerate(page_images, 1):
            # Convert image to base64
            img_base64 = self._image_to_base64(image)
            
            prompt = f"""
Analyze this examination paper page and extract all questions.

## Paper Context
- Subject: {paper.syllabus.subject.name}
- Level: {paper.syllabus.level_name}
- Year: {paper.year}
- Paper: {paper.paper_number}

## Task
Extract each question with:
1. Question number (e.g., "1", "2a", "3b(ii)")
2. Full question text
3. Mark allocation
4. Question type (mcq, short, structured, essay, calculation, diagram, practical, data)
5. Whether it has a diagram
6. If diagram exists: bounding box coordinates (x, y, width, height in pixels)
7. For MCQ: the options (A, B, C, D)

Return JSON array:
[
    {{
        "question_number": "1a",
        "question_text": "...",
        "marks": 3,
        "question_type": "short",
        "has_diagram": false,
        "diagram_coords": null,
        "options": null,
        "confidence": 0.95
    }}
]
"""
            
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_base64}},
                        {"type": "text", "text": prompt}
                    ]
                }]
            )
            
            page_questions = self._parse_questions(response, page_num)
            all_questions.extend(page_questions)
        
        return all_questions
    
    def _crop_diagram(
        self,
        page_image: Image.Image,
        coords: dict
    ) -> Image.Image:
        """Crop diagram from page image."""
        
        x, y, width, height = coords['x'], coords['y'], coords['width'], coords['height']
        
        # Add padding
        padding = 10
        x = max(0, x - padding)
        y = max(0, y - padding)
        width = min(page_image.width - x, width + 2*padding)
        height = min(page_image.height - y, height + 2*padding)
        
        return page_image.crop((x, y, x + width, y + height))
```

### Celery Tasks

```python
# apps/pdf_processor/tasks.py

from celery import shared_task

@shared_task(bind=True, max_retries=3)
def process_paper_task(self, paper_id: str):
    """
    Async task to process a paper PDF.
    """
    try:
        paper = Paper.objects.get(id=paper_id)
        paper.processing_status = Paper.ProcessingStatus.PROCESSING
        paper.save()
        
        processor = PDFProcessor()
        result = processor.process_paper(paper)
        
        paper.processing_status = Paper.ProcessingStatus.COMPLETED
        if result.needs_review:
            paper.processing_status = Paper.ProcessingStatus.NEEDS_REVIEW
            paper.processing_notes = f"{len(result.needs_review)} questions need review"
        
        paper.save()
        
    except Exception as e:
        paper.processing_status = Paper.ProcessingStatus.FAILED
        paper.processing_notes = str(e)
        paper.save()
        raise self.retry(exc=e, countdown=60)


@shared_task
def bulk_process_papers(paper_ids: List[str]):
    """
    Process multiple papers in sequence.
    """
    for paper_id in paper_ids:
        process_paper_task.delay(paper_id)
```

---

## User Experience Requirements

### Performance
- Pages must load in under 2 seconds on 3G connections
- Implement skeleton loading states for all data-fetching components
- Lazy load images and PDFs
- Cache API responses aggressively
- Support offline mode for downloaded papers (PWA)

### Mobile-First Design
- All features must work on mobile devices
- Touch-friendly tap targets (minimum 44px)
- Bottom navigation for primary actions
- Swipe gestures for question navigation
- Responsive PDF viewer with pinch-to-zoom
- Teacher dashboard must be usable on tablet

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- Screen reader compatible
- High contrast mode
- Adjustable font sizes

### Error Handling
- Graceful degradation when offline
- Clear error messages with recovery actions
- Retry mechanisms for failed requests
- Form validation with inline errors

### Feedback & Notifications
- Toast notifications for actions (Sonner)
- Progress indicators for long operations
- Confirmation dialogs for destructive actions
- Success animations (Framer Motion)

---

## Security Requirements

### Authentication
- JWT with refresh tokens
- Token rotation on refresh
- Secure HTTP-only cookies for tokens
- Rate limiting on auth endpoints
- Account lockout after failed attempts

### API Security
- CORS configuration
- CSRF protection
- Input validation and sanitization
- SQL injection prevention (ORM)
- XSS prevention

### Role-Based Access Control
```python
# core/permissions.py

class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.user_type == 'teacher'

class IsSchoolAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.user_type == 'school_admin'

class IsParent(BasePermission):
    def has_permission(self, request, view):
        return request.user.user_type == 'parent'

class CanAccessClass(BasePermission):
    def has_object_permission(self, request, view, obj):
        # Teachers can only access their own classes
        if request.user.user_type == 'teacher':
            return obj.teacher.user == request.user
        # School admins can access any class in their school
        if request.user.user_type == 'school_admin':
            return obj.school == request.user.teacher_profile.school
        return False

class ParentCanViewChild(BasePermission):
    def has_object_permission(self, request, view, obj):
        return ParentLink.objects.filter(
            parent=request.user,
            student=obj,
            is_verified=True
        ).exists()
```

### Data Protection
- Encrypt sensitive data at rest
- HTTPS everywhere
- Secure file upload validation
- User data export/deletion (GDPR-like)
- Parent-child links require verification

---

## Go-To-Market Strategy

### Phase 1: Teacher Champions (Month 1-2)
1. Identify 20-30 tech-savvy teachers in target schools
2. Offer free premium access in exchange for feedback
3. Let them use the platform for personal prep
4. Build case studies from their experience

### Phase 2: Classroom Pilots (Month 2-4)
1. Teachers invite their classes to use the platform
2. Provide free School Basic tier for pilot schools
3. Gather data on usage patterns and results
4. Document "before/after" improvements

### Phase 3: School Sales (Month 4-6)
1. Approach school administrators with teacher testimonials
2. Target private schools first (faster decision making)
3. Offer term-based trials
4. Present at teacher workshops and education conferences

### Phase 4: Scale (Month 6+)
1. Partner with textbook distributors
2. Approach ministry of education
3. NGO partnerships (CAMFED, World Vision)
4. Expand to other African markets

### Sales Materials Needed
- One-pager for school administrators
- Teacher testimonial videos
- Case study PDFs
- ROI calculator (cost vs. photocopy savings)
- Demo school account

---

## Development Phases

### Phase 1: MVP - Student Core (4-6 weeks)
- User auth (register, login, profile)
- Browse papers by board/subject/year
- View questions (text + basic diagram display)
- MCQ answering with auto-marking
- Basic text answer submission
- Simple AI marking for short answers
- Basic progress tracking

### Phase 2: Enhanced Marking (3-4 weeks)
- Full AI marking for all question types
- Detailed feedback and breakdown
- Marking scheme generation
- Answer review and explanation

### Phase 3: Teacher Features (4-5 weeks)
- Teacher registration and profiles
- Class creation and student management
- Assignment builder
- Submission tracking
- Basic class analytics
- Teacher dashboard

### Phase 4: Progress & Analytics (3-4 weeks)
- Topic-based progress tracking
- Mastery levels
- Weak area identification
- Personalized recommendations
- Study streaks
- Enhanced teacher analytics

### Phase 5: B2B & School Features (4-5 weeks)
- School admin dashboard
- Multi-teacher management
- School-wide analytics
- Parent portal (basic)
- Subscription management
- WhatsApp notifications

### Phase 6: Polish & Scale (2-3 weeks)
- Performance optimization
- PWA implementation
- Bulk upload tools
- Monitoring and logging
- Documentation

---

## Getting Started

1. Initialize the Django project with the specified app structure
2. Set up PostgreSQL and Redis
3. Create all models with migrations
4. Implement authentication endpoints first
5. Build the paper/question browsing APIs
6. Create the React app with routing
7. Build the UI component library
8. Implement paper browsing and display
9. Add attempt and answer submission
10. Integrate AI marking
11. Build student progress tracking
12. **Add teacher features (classes, assignments)**
13. **Build teacher dashboard**
14. **Add school admin features**
15. **Implement notification system**
16. **Build parent portal**

Prioritize working software over perfection. Ship incrementally and iterate based on user feedback.

---

## Technical Notes

### Database Indexes
Create indexes on:
- `Paper.syllabus_id, Paper.year, Paper.is_published`
- `Question.paper_id, Question.display_order`
- `Answer.attempt_id, Answer.question_id`
- `TopicProgress.user_id, TopicProgress.topic_id`
- `Attempt.user_id, Attempt.status, Attempt.started_at`
- `Class.school_id, Class.academic_year, Class.is_active`
- `Assignment.due_date, Assignment.is_published`
- `AssignmentSubmission.assignment_id, AssignmentSubmission.status`
- `User.school_id, User.current_form`

### Environment Variables
```
DATABASE_URL=
REDIS_URL=
SECRET_KEY=
ANTHROPIC_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
ALLOWED_HOSTS=
CORS_ALLOWED_ORIGINS=

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Email (SendGrid)
SENDGRID_API_KEY=
DEFAULT_FROM_EMAIL=

# Payments (optional)
PAYNOW_INTEGRATION_ID=
PAYNOW_INTEGRATION_KEY=
```

### Testing Strategy
- Unit tests for services and utilities
- Integration tests for API endpoints
- E2E tests for critical user flows (Playwright)
- AI marking accuracy benchmarks
- Load testing for school-wide usage

---

This prompt provides the complete blueprint including B2B features for teachers, schools, and parents. Build it module by module, test thoroughly, and ship fast. The B2B angle is your path to sustainable revenue. Good luck! 🚀