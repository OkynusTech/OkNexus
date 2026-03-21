# OkNexus

OkNexus is a comprehensive **Security Engagement Management Platform** designed to streamline the process of managing security assessments, pen-testing engagements, and vulnerability reporting. Built with modern web technologies, it offers a powerful dashboard for security professionals to track findings, manage clients, and generate insightful reports.

## 🚀 Features

-   **Engagement Management**: Create and track security engagements with detailed metadata (dates, audit type, status).
-   **Vulnerability Tracking**: comprehensive system for logging findings with severity ratings (Critical, High, Medium, Low, Info).
-   **Interactive Dashboard**: Real-time overview of active engagements, identifying key metrics and vulnerability statistics.
-   **Client & Service Provider Management**: Maintain profiles for clients and service providers.
-   **Analytics & Insights**: specialized executive insights and visual analytics using Recharts.
-   **AI-Powered Assistance**: Integrated AI capabilities for enhanced analysis and reporting support.
-   **Reporting & Templates**: robust reporting engine with custom templates and export capabilities (JSON/PDF).
-   **CWE Integration**: Built-in support for Common Weakness Enumeration (CWE) database.
-   **Dark Mode Support**: fully thematic UI with light/dark mode toggles.

## 🛠️ Tech Stack

-   **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
-   **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
-   **Authentication**: [NextAuth.js](https://next-auth.js.org/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Charts**: [Recharts](https://recharts.org/)
-   **AI/ML**: @xenova/transformers, groq-sdk
-   **Date Handling**: date-fns

## 📦 Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/oknexus.git
    cd oknexus
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  Set up environment variables:
    Create a `.env.local` file in the root directory and configure the following variables:
    ```env
    # Authentication (NextAuth & Google Provider)
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    NEXTAUTH_SECRET=your_nextauth_secret
    NEXTAUTH_URL=http://localhost:3000

    # AI Integration (Groq)
    GROQ_API_KEY=your_groq_api_key
    NEXT_PUBLIC_AI_ENABLED=true
    ```

4.  Run the development server:
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📜 Scripts

-   `npm run dev`: Starts the development server with Turbopack.
-   `npm run build`: Builds the application for production.
-   `npm start`: Starts the production server.
-   `npm run lint`: Runs ESLint to check for code quality issues.

## 📁 Project Structure

-   `/app`: Next.js App Router pages and layouts.
-   `/components`: Reusable UI components (shadcn/ui and custom).
-   `/lib`: Utility functions, types, storage logic, and AI services.
-   `/public`: Static assets.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)
