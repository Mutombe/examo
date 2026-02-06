"""
Management command to seed the database with sample data.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.exams.models import ExaminationBoard, Subject, Syllabus, Paper, Question, Topic
from apps.schools.models import School, TeacherProfile, Class

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds the database with sample examination data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Create Examination Boards
        self.stdout.write('Creating examination boards...')
        zimsec, _ = ExaminationBoard.objects.get_or_create(
            short_name='ZIMSEC',
            defaults={
                'name': 'Zimbabwe School Examinations Council',
                'description': 'The official examination body for Zimbabwe secondary schools.',
                'country': 'Zimbabwe',
                'website': 'https://www.zimsec.co.zw',
            }
        )

        cambridge, _ = ExaminationBoard.objects.get_or_create(
            short_name='CIE',
            defaults={
                'name': 'Cambridge International Examinations',
                'description': 'International examination board offering IGCSE and A Level qualifications.',
                'country': 'International',
                'website': 'https://www.cambridgeinternational.org',
            }
        )

        # Create Subjects
        self.stdout.write('Creating subjects...')
        subjects_data = [
            {'name': 'Mathematics', 'code': 'MATH', 'color': '#3B82F6', 'icon': 'calculator'},
            {'name': 'Physics', 'code': 'PHY', 'color': '#8B5CF6', 'icon': 'atom'},
            {'name': 'Chemistry', 'code': 'CHEM', 'color': '#10B981', 'icon': 'flask'},
            {'name': 'Biology', 'code': 'BIO', 'color': '#F59E0B', 'icon': 'leaf'},
            {'name': 'English Language', 'code': 'ENG', 'color': '#EF4444', 'icon': 'book'},
            {'name': 'History', 'code': 'HIST', 'color': '#6366F1', 'icon': 'landmark'},
        ]

        subjects = {}
        for data in subjects_data:
            subject, _ = Subject.objects.get_or_create(
                name=data['name'],
                defaults=data
            )
            subjects[data['name']] = subject

        # Create Syllabi
        self.stdout.write('Creating syllabi...')
        syllabi_data = [
            {'board': zimsec, 'subject': subjects['Mathematics'], 'level': 'o_level', 'syllabus_code': '4004'},
            {'board': zimsec, 'subject': subjects['Physics'], 'level': 'o_level', 'syllabus_code': '4006'},
            {'board': zimsec, 'subject': subjects['Chemistry'], 'level': 'o_level', 'syllabus_code': '4007'},
            {'board': zimsec, 'subject': subjects['Biology'], 'level': 'o_level', 'syllabus_code': '4008'},
            {'board': zimsec, 'subject': subjects['English Language'], 'level': 'o_level', 'syllabus_code': '4001'},
            {'board': cambridge, 'subject': subjects['Mathematics'], 'level': 'igcse', 'syllabus_code': '0580'},
            {'board': cambridge, 'subject': subjects['Physics'], 'level': 'igcse', 'syllabus_code': '0625'},
        ]

        syllabi = {}
        for data in syllabi_data:
            syllabus, _ = Syllabus.objects.get_or_create(
                board=data['board'],
                subject=data['subject'],
                level=data['level'],
                defaults={'syllabus_code': data['syllabus_code']}
            )
            syllabi[f"{data['board'].short_name}_{data['subject'].name}_{data['level']}"] = syllabus

        # Create Topics
        self.stdout.write('Creating topics...')
        math_syllabus = syllabi['ZIMSEC_Mathematics_o_level']
        physics_syllabus = syllabi['ZIMSEC_Physics_o_level']

        # Math Topics
        math_topics_data = [
            {'name': 'Number', 'slug': 'number', 'description': 'Number systems, operations, and properties'},
            {'name': 'Algebra', 'slug': 'algebra', 'description': 'Algebraic expressions, equations, and inequalities'},
            {'name': 'Geometry', 'slug': 'geometry', 'description': 'Shapes, angles, and spatial relationships'},
            {'name': 'Trigonometry', 'slug': 'trigonometry', 'description': 'Trigonometric ratios and applications'},
            {'name': 'Statistics', 'slug': 'statistics', 'description': 'Data collection, presentation, and analysis'},
            {'name': 'Probability', 'slug': 'probability', 'description': 'Chance and likelihood'},
        ]

        math_topics = {}
        for data in math_topics_data:
            topic, _ = Topic.objects.get_or_create(
                syllabus=math_syllabus,
                slug=data['slug'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                }
            )
            math_topics[data['slug']] = topic

        # Math Subtopics
        algebra_subtopics = [
            {'name': 'Indices', 'slug': 'indices', 'description': 'Laws of indices and their applications'},
            {'name': 'Linear Equations', 'slug': 'linear-equations', 'description': 'Solving and graphing linear equations'},
            {'name': 'Quadratic Equations', 'slug': 'quadratic-equations', 'description': 'Factorization and quadratic formula'},
            {'name': 'Factorization', 'slug': 'factorization', 'description': 'Factorizing algebraic expressions'},
        ]

        for data in algebra_subtopics:
            Topic.objects.get_or_create(
                syllabus=math_syllabus,
                slug=data['slug'],
                parent=math_topics['algebra'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                }
            )

        geometry_subtopics = [
            {'name': 'Angles', 'slug': 'angles', 'description': 'Types of angles and angle relationships'},
            {'name': 'Triangles', 'slug': 'triangles', 'description': 'Properties and theorems of triangles'},
            {'name': 'Circles', 'slug': 'circles', 'description': 'Circle theorems and calculations'},
            {'name': 'Mensuration', 'slug': 'mensuration', 'description': 'Perimeter, area, and volume'},
        ]

        for data in geometry_subtopics:
            Topic.objects.get_or_create(
                syllabus=math_syllabus,
                slug=data['slug'],
                parent=math_topics['geometry'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                }
            )

        # Physics Topics
        physics_topics_data = [
            {'name': 'Mechanics', 'slug': 'mechanics', 'description': 'Motion, forces, and energy'},
            {'name': 'Waves', 'slug': 'waves', 'description': 'Wave properties and behavior'},
            {'name': 'Electricity', 'slug': 'electricity', 'description': 'Electric circuits and components'},
            {'name': 'Thermal Physics', 'slug': 'thermal-physics', 'description': 'Heat and temperature'},
            {'name': 'Nuclear Physics', 'slug': 'nuclear-physics', 'description': 'Atomic structure and radioactivity'},
        ]

        physics_topics = {}
        for data in physics_topics_data:
            topic, _ = Topic.objects.get_or_create(
                syllabus=physics_syllabus,
                slug=data['slug'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                }
            )
            physics_topics[data['slug']] = topic

        # Physics Subtopics
        mechanics_subtopics = [
            {'name': 'Motion', 'slug': 'motion', 'description': 'Speed, velocity, and acceleration'},
            {'name': 'Forces', 'slug': 'forces', 'description': 'Types of forces and Newton\'s laws'},
            {'name': 'Energy', 'slug': 'energy', 'description': 'Forms of energy and conservation'},
            {'name': 'Momentum', 'slug': 'momentum', 'description': 'Momentum and collisions'},
        ]

        for data in mechanics_subtopics:
            Topic.objects.get_or_create(
                syllabus=physics_syllabus,
                slug=data['slug'],
                parent=physics_topics['mechanics'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                }
            )

        # Create Papers
        self.stdout.write('Creating papers...')

        paper1, _ = Paper.objects.get_or_create(
            syllabus=math_syllabus,
            year=2023,
            session='november',
            paper_type='paper_1',
            defaults={
                'title': 'Mathematics Paper 1 - November 2023',
                'duration_minutes': 150,
                'total_marks': 100,
                'instructions': '''Answer ALL questions in Section A and any FOUR questions from Section B.
Show all working clearly.
Calculators may be used.'''
            }
        )

        paper2, _ = Paper.objects.get_or_create(
            syllabus=physics_syllabus,
            year=2023,
            session='november',
            paper_type='paper_1',
            defaults={
                'title': 'Physics Paper 1 - November 2023',
                'duration_minutes': 120,
                'total_marks': 80,
                'instructions': '''Answer ALL questions.
Show all working clearly.
Take g = 10 m/s².'''
            }
        )

        # Create Questions for Math Paper
        self.stdout.write('Creating questions...')

        # Get topic references for linking
        indices_topic = Topic.objects.filter(syllabus=math_syllabus, slug='indices').first()
        algebra_topic = math_topics.get('algebra')
        geometry_topic = math_topics.get('geometry')
        forces_topic = Topic.objects.filter(syllabus=physics_syllabus, slug='forces').first()
        motion_topic = Topic.objects.filter(syllabus=physics_syllabus, slug='motion').first()
        energy_topic = Topic.objects.filter(syllabus=physics_syllabus, slug='energy').first()

        # MCQ Questions
        math_questions = [
            {
                'question_number': '1',
                'question_text': 'What is the value of 2³ × 3²?',
                'question_type': 'mcq',
                'marks': 1,
                'options': [
                    {'key': 'A', 'text': '36'},
                    {'key': 'B', 'text': '72'},
                    {'key': 'C', 'text': '54'},
                    {'key': 'D', 'text': '48'},
                ],
                'correct_answer': 'B',
                'topic_text': 'Indices',
                'difficulty': 'easy',
                'order': 1,
                'topic_obj': indices_topic,
            },
            {
                'question_number': '2',
                'question_text': 'Simplify: (x² + 5x + 6) ÷ (x + 2)',
                'question_type': 'mcq',
                'marks': 1,
                'options': [
                    {'key': 'A', 'text': 'x + 3'},
                    {'key': 'B', 'text': 'x + 2'},
                    {'key': 'C', 'text': 'x - 3'},
                    {'key': 'D', 'text': 'x² + 3'},
                ],
                'correct_answer': 'A',
                'topic_text': 'Algebra',
                'difficulty': 'medium',
                'order': 2,
                'topic_obj': algebra_topic,
            },
            {
                'question_number': '3',
                'question_text': 'The angles of a triangle are in the ratio 2:3:4. What is the largest angle?',
                'question_type': 'mcq',
                'marks': 1,
                'options': [
                    {'key': 'A', 'text': '40°'},
                    {'key': 'B', 'text': '60°'},
                    {'key': 'C', 'text': '80°'},
                    {'key': 'D', 'text': '100°'},
                ],
                'correct_answer': 'C',
                'topic_text': 'Geometry',
                'difficulty': 'easy',
                'order': 3,
                'topic_obj': geometry_topic,
            },
            {
                'question_number': '4',
                'question_text': 'Solve the equation: 3x - 7 = 2x + 5',
                'question_type': 'short_answer',
                'marks': 3,
                'marking_scheme': '''Award marks as follows:
- 1 mark for collecting like terms correctly (3x - 2x = 5 + 7)
- 1 mark for simplifying (x = 12)
- 1 mark for correct final answer''',
                'sample_answer': 'x = 12',
                'topic_text': 'Algebra',
                'difficulty': 'easy',
                'order': 4,
                'topic_obj': algebra_topic,
            },
            {
                'question_number': '5',
                'question_text': 'A rectangle has length 12 cm and width 5 cm. Calculate its perimeter and area.',
                'question_type': 'short_answer',
                'marks': 4,
                'marking_scheme': '''Award marks as follows:
- 1 mark for perimeter formula (P = 2(l + w))
- 1 mark for correct perimeter (34 cm)
- 1 mark for area formula (A = l × w)
- 1 mark for correct area (60 cm²)''',
                'sample_answer': 'Perimeter = 2(12 + 5) = 34 cm\nArea = 12 × 5 = 60 cm²',
                'topic_text': 'Geometry',
                'difficulty': 'easy',
                'order': 5,
                'topic_obj': geometry_topic,
            },
            {
                'question_number': '6',
                'question_text': 'Factorize completely: x² - 9',
                'question_type': 'short_answer',
                'marks': 2,
                'marking_scheme': '''Award marks as follows:
- 1 mark for recognizing difference of squares
- 1 mark for correct factorization (x + 3)(x - 3)''',
                'sample_answer': '(x + 3)(x - 3)',
                'topic_text': 'Algebra',
                'difficulty': 'medium',
                'order': 6,
                'topic_obj': algebra_topic,
            },
        ]

        for q_data in math_questions:
            topic_obj = q_data.pop('topic_obj', None)
            question, created = Question.objects.get_or_create(
                paper=paper1,
                question_number=q_data['question_number'],
                defaults=q_data
            )
            if topic_obj and created:
                question.topics.add(topic_obj)

        # Physics questions
        physics_questions = [
            {
                'question_number': '1',
                'question_text': 'What is the SI unit of force?',
                'question_type': 'mcq',
                'marks': 1,
                'options': [
                    {'key': 'A', 'text': 'Joule'},
                    {'key': 'B', 'text': 'Newton'},
                    {'key': 'C', 'text': 'Watt'},
                    {'key': 'D', 'text': 'Pascal'},
                ],
                'correct_answer': 'B',
                'topic_text': 'Forces',
                'difficulty': 'easy',
                'order': 1,
                'topic_obj': forces_topic,
            },
            {
                'question_number': '2',
                'question_text': 'A car travels 150 km in 2 hours. What is its average speed?',
                'question_type': 'mcq',
                'marks': 1,
                'options': [
                    {'key': 'A', 'text': '50 km/h'},
                    {'key': 'B', 'text': '75 km/h'},
                    {'key': 'C', 'text': '100 km/h'},
                    {'key': 'D', 'text': '300 km/h'},
                ],
                'correct_answer': 'B',
                'topic_text': 'Motion',
                'difficulty': 'easy',
                'order': 2,
                'topic_obj': motion_topic,
            },
            {
                'question_number': '3',
                'question_text': 'Calculate the kinetic energy of a 2 kg object moving at 5 m/s.',
                'question_type': 'short_answer',
                'marks': 3,
                'marking_scheme': '''Award marks as follows:
- 1 mark for correct formula (KE = ½mv²)
- 1 mark for correct substitution (KE = ½ × 2 × 5²)
- 1 mark for correct answer with units (25 J)''',
                'sample_answer': 'KE = ½mv² = ½ × 2 × 5² = ½ × 2 × 25 = 25 J',
                'topic_text': 'Energy',
                'difficulty': 'medium',
                'order': 3,
                'topic_obj': energy_topic,
            },
            {
                'question_number': '4',
                'question_text': 'Explain why a bus driver wears a seatbelt.',
                'question_type': 'short_answer',
                'marks': 3,
                'marking_scheme': '''Award marks for:
- Reference to inertia/Newton's first law (1 mark)
- Explanation that body continues moving when bus stops suddenly (1 mark)
- Seatbelt provides restraining force to prevent injury (1 mark)''',
                'sample_answer': 'When the bus stops suddenly, the driver\'s body tends to continue moving forward due to inertia (Newton\'s first law). The seatbelt provides a restraining force that prevents the driver from being thrown forward, reducing the risk of injury.',
                'topic_text': 'Forces',
                'difficulty': 'medium',
                'order': 4,
                'topic_obj': forces_topic,
            },
        ]

        for q_data in physics_questions:
            topic_obj = q_data.pop('topic_obj', None)
            question, created = Question.objects.get_or_create(
                paper=paper2,
                question_number=q_data['question_number'],
                defaults=q_data
            )
            if topic_obj and created:
                question.topics.add(topic_obj)

        # Create Sample School and Teacher
        self.stdout.write('Creating sample school and teacher...')

        school, _ = School.objects.get_or_create(
            slug='sample-high-school',
            defaults={
                'name': 'Sample High School',
                'school_type': 'government',
                'province': 'Harare',
                'city': 'Harare',
                'address': '123 Sample Street, Harare',
                'email': 'info@samplehigh.ac.zw',
                'phone': '+263 4 123 4567',
                'is_verified': True,
                'is_active': True,
            }
        )

        # Create a demo teacher user
        teacher_user, created = User.objects.get_or_create(
            email='teacher@example.com',
            defaults={
                'username': 'teacher_demo',
                'first_name': 'Demo',
                'last_name': 'Teacher',
                'role': 'teacher',
                'is_active': True,
            }
        )
        if created:
            teacher_user.set_password('teacher123')
            teacher_user.save()

        # Create teacher profile
        teacher_profile, _ = TeacherProfile.objects.get_or_create(
            user=teacher_user,
            defaults={
                'school': school,
                'employee_id': 'T001',
                'department': 'Science',
                'role': 'teacher',
                'can_create_assignments': True,
                'can_view_school_analytics': True,
            }
        )
        teacher_profile.subjects.add(subjects['Mathematics'], subjects['Physics'])

        # Create a demo student user
        student_user, created = User.objects.get_or_create(
            email='student@example.com',
            defaults={
                'username': 'student_demo',
                'first_name': 'Demo',
                'last_name': 'Student',
                'role': 'student',
                'current_form': 4,
                'is_active': True,
            }
        )
        if created:
            student_user.set_password('student123')
            student_user.save()

        # Create a demo admin user
        admin_user, created = User.objects.get_or_create(
            email='admin@example.com',
            defaults={
                'username': 'admin_demo',
                'first_name': 'Demo',
                'last_name': 'Admin',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()

        # Create a demo parent user
        parent_user, created = User.objects.get_or_create(
            email='parent@example.com',
            defaults={
                'username': 'parent_demo',
                'first_name': 'Demo',
                'last_name': 'Parent',
                'role': 'parent',
                'is_active': True,
            }
        )
        if created:
            parent_user.set_password('parent123')
            parent_user.save()

        # Create a demo school admin user
        school_admin_user, created = User.objects.get_or_create(
            email='schooladmin@example.com',
            defaults={
                'username': 'school_admin_demo',
                'first_name': 'Demo',
                'last_name': 'SchoolAdmin',
                'role': 'school_admin',
                'is_active': True,
            }
        )
        if created:
            school_admin_user.set_password('schooladmin123')
            school_admin_user.save()

        # Create school admin's teacher profile
        school_admin_profile, _ = TeacherProfile.objects.get_or_create(
            user=school_admin_user,
            defaults={
                'school': school,
                'employee_id': 'SA001',
                'department': 'Administration',
                'role': 'head',
                'can_create_assignments': True,
                'can_view_school_analytics': True,
                'can_manage_teachers': True,
                'can_manage_students': True,
            }
        )

        # Create sample classes
        math_class, _ = Class.objects.get_or_create(
            school=school,
            teacher=teacher_profile,
            subject=subjects['Mathematics'],
            name='Form 4 Mathematics',
            academic_year=2024,
            defaults={
                'form_level': 4,
                'term': 1,
                'max_students': 40,
                'allow_join': True,
            }
        )
        math_class.students.add(student_user)

        physics_class, _ = Class.objects.get_or_create(
            school=school,
            teacher=teacher_profile,
            subject=subjects['Physics'],
            name='Form 4 Physics',
            academic_year=2024,
            defaults={
                'form_level': 4,
                'term': 1,
                'max_students': 35,
                'allow_join': True,
            }
        )
        physics_class.students.add(student_user)

        self.stdout.write(self.style.SUCCESS('Database seeded successfully!'))
        self.stdout.write(f'Created {ExaminationBoard.objects.count()} boards')
        self.stdout.write(f'Created {Subject.objects.count()} subjects')
        self.stdout.write(f'Created {Syllabus.objects.count()} syllabi')
        self.stdout.write(f'Created {Topic.objects.count()} topics')
        self.stdout.write(f'Created {Paper.objects.count()} papers')
        self.stdout.write(f'Created {Question.objects.count()} questions')
        self.stdout.write(f'Created {School.objects.count()} schools')
        self.stdout.write(f'Created {Class.objects.count()} classes')
        self.stdout.write('')
        self.stdout.write('Demo credentials:')
        self.stdout.write('  Admin:        admin@example.com / admin123')
        self.stdout.write('  School Admin: schooladmin@example.com / schooladmin123')
        self.stdout.write('  Teacher:      teacher@example.com / teacher123')
        self.stdout.write('  Parent:       parent@example.com / parent123')
        self.stdout.write('  Student:      student@example.com / student123')
