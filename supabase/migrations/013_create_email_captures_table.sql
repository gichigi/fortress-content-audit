-- fortress v1
-- Create email_captures table for tracking email captures and payment status
-- Used for abandoned cart recovery and thank you email tracking

CREATE TABLE IF NOT EXISTS public.email_captures (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  session_token TEXT NOT NULL,
  email TEXT NOT NULL,
  payment_completed BOOLEAN DEFAULT false NOT NULL,
  abandoned_email_sent BOOLEAN DEFAULT false NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.email_captures OWNER TO postgres;

-- Primary key
ALTER TABLE ONLY public.email_captures
  ADD CONSTRAINT email_captures_pkey PRIMARY KEY (id);

-- Unique constraint on session_token
ALTER TABLE ONLY public.email_captures
  ADD CONSTRAINT email_captures_session_token_key UNIQUE (session_token);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_captures_session_token ON public.email_captures(session_token);
CREATE INDEX IF NOT EXISTS idx_email_captures_email ON public.email_captures(email);

-- Enable RLS
ALTER TABLE public.email_captures ENABLE ROW LEVEL SECURITY;

-- Comment for documentation
COMMENT ON TABLE public.email_captures IS 
  'Tracks email captures and payment status for abandoned cart and thank you emails';
