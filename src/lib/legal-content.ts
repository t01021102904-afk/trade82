import type { Locale } from "@/lib/i18n";

export type LegalDocumentKey = "terms" | "sourcingTerms" | "privacy" | "business";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const CONTACT_EMAIL = "contact@trade82.com";

export const legalPathByDocument: Record<LegalDocumentKey, string> = {
  terms: "/terms",
  sourcingTerms: "/sourcing-terms",
  privacy: "/privacy",
  business: "/business",
};

export const legalDocuments: Record<Locale, Record<LegalDocumentKey, LegalDocument>> = {
  en: {
    terms: {
      title: "Terms of Service",
      description:
        "The general terms that apply when using Trade82's marketplace platform.",
      updatedAt: "June 27, 2026",
      sections: [
        {
          title: "1. Service overview",
          paragraphs: [
            "Trade82 provides a B2B marketplace platform that helps Korean sellers and American buyers discover company profiles, product information, inquiries, messages, and transaction-related communications.",
            "Trade82 is not a party to transactions between sellers and buyers. The parties are responsible for deciding whether to proceed with any inquiry, negotiation, contract, payment, shipment, import, export, or after-sales matter.",
          ],
        },
        {
          title: "2. Accounts and eligibility",
          paragraphs: [
            "Users must provide accurate account information and keep login credentials secure. Users are responsible for activity that occurs through their accounts.",
            "Companies using Trade82 must be represented by an authorized person. Trade82 may request updates, pause public listing, or restrict access if account or company information appears incomplete, inaccurate, unsafe, or inconsistent with marketplace requirements.",
          ],
        },
        {
          title: "3. Company and product information",
          paragraphs: [
            "Sellers and buyers are responsible for the accuracy and completeness of company profiles, product descriptions, pricing, availability, lead times, regulatory information, submitted documents, and transaction communications.",
            "Trade82 may review submitted company profile information for marketplace quality, but Trade82 does not guarantee product claims, payment performance, legal compliance, customs clearance, or transaction outcomes.",
          ],
        },
        {
          title: "4. Marketplace communications",
          paragraphs: [
            "Inquiries, messages, attachments, and deal records are provided to help users organize sourcing discussions. Users should not send unlawful, misleading, abusive, confidential third-party, or unsafe content through the platform.",
            "Users should keep independent records of contracts, invoices, payment instructions, shipping documents, and other business-critical information outside the platform.",
          ],
        },
        {
          title: "5. Documents and attachments",
          paragraphs: [
            "Users may submit company documents, product materials, message attachments, or transaction-related files where the platform supports upload. Users must have the right to upload those files and must not upload malware, executable files, or content that violates law or third-party rights.",
            "Private files are intended for restricted access only. Users remain responsible for confirming document authenticity and legal sufficiency before relying on any document.",
          ],
        },
        {
          title: "6. Reviews and public content",
          paragraphs: [
            "Reviews and public profile content must be truthful, relevant, and based on real business interactions. Trade82 may hide, remove, or restrict content that appears abusive, misleading, irrelevant, unlawful, or unsafe.",
            "Public reviews and listing status labels are marketplace features and should not be interpreted as a promise that any transaction will succeed.",
          ],
        },
        {
          title: "7. Prohibited conduct",
          bullets: [
            "Using the platform for fraud, impersonation, spam, malware, or unlawful transactions.",
            "Uploading false, misleading, confidential, or unauthorized documents.",
            "Attempting to bypass authentication, authorization, rate limits, storage restrictions, or security controls.",
            "Scraping, copying, or reusing marketplace data in a way that harms Trade82 or its users.",
          ],
        },
        {
          title: "8. No transaction guarantee",
          paragraphs: [
            "Unless separately stated in a signed written agreement, Trade82 does not provide payment protection, escrow services, import approval, customs clearance, legal advice, tax advice, product compliance review, or any guarantee that a transaction will be completed.",
            "Users should conduct their own due diligence, contract review, legal review, product compliance review, and payment-safety checks before entering into any transaction.",
          ],
        },
        {
          title: "9. Changes, suspension, and termination",
          paragraphs: [
            "Trade82 may update the platform, change features, pause listings, restrict accounts, or remove content when necessary to operate the service, protect users, comply with law, or manage marketplace quality.",
            "Users may stop using the service at any time. Certain records may be retained where needed for security, legal, audit, dispute, or business continuity purposes.",
          ],
        },
        {
          title: "10. Contact",
          paragraphs: [
            `For questions about Trade82, contact us at ${CONTACT_EMAIL}.`,
          ],
        },
      ],
    },
    sourcingTerms: {
      title: "Sourcing and Transaction Support Service Terms",
      description:
        "Additional terms for optional sourcing coordination and transaction-support workflows.",
      updatedAt: "June 27, 2026",
      sections: [
        {
          title: "1. Scope of support",
          paragraphs: [
            "Trade82 may provide tools that help users organize sourcing inquiries, message threads, company information, product information, submitted documents, deal status, and review requests.",
            "Any sourcing or transaction-support feature is administrative and informational unless Trade82 separately enters into a signed written service agreement with specific obligations.",
          ],
        },
        {
          title: "2. User responsibilities",
          bullets: [
            "Buyers are responsible for confirming product suitability, import requirements, labeling requirements, payment safety, and supplier reliability.",
            "Sellers are responsible for confirming product information, export readiness, pricing, lead times, packaging, shipping conditions, and document accuracy.",
            "Both parties are responsible for reviewing contracts, invoices, payment instructions, shipping documents, and applicable laws before proceeding.",
          ],
        },
        {
          title: "3. Communications and introductions",
          paragraphs: [
            "Trade82 may help route inquiries or organize messages between platform users. Trade82 does not become the buyer, seller, importer, exporter, customs broker, freight forwarder, payment processor, or contracting party solely by providing these tools.",
            "Users should independently verify the identity, authority, and reliability of any counterparty before sharing sensitive information or making payments.",
          ],
        },
        {
          title: "4. Documents and transaction records",
          paragraphs: [
            "Uploaded files and deal records are provided for convenience and organization. Trade82 does not guarantee that submitted documents are complete, current, authentic, legally sufficient, or accepted by any government agency, logistics provider, marketplace, bank, or counterparty.",
            "Users should obtain professional advice where needed for customs, import, export, tax, safety, labeling, privacy, and regulatory matters.",
          ],
        },
        {
          title: "5. Fees and separate agreements",
          paragraphs: [
            "If Trade82 later offers paid sourcing or transaction-support services, the applicable fees, scope, deliverables, and cancellation terms should be stated in a separate written agreement or checkout flow.",
            "These terms do not create an obligation for Trade82 to provide custom sourcing, negotiation, inspection, payment handling, logistics, or dispute-resolution services.",
          ],
        },
        {
          title: "6. No outcome guarantee",
          paragraphs: [
            "Trade82 does not guarantee that a buyer will purchase, that a seller will fulfill, that documents will be accepted, that payment will be completed, that goods will clear customs, or that any transaction will close successfully.",
            "Users remain responsible for due diligence and final business decisions.",
          ],
        },
        {
          title: "7. Contact",
          paragraphs: [
            `For questions about Trade82, contact us at ${CONTACT_EMAIL}.`,
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      description:
        "How Trade82 handles account, company, marketplace, communication, and file information.",
      updatedAt: "June 27, 2026",
      sections: [
        {
          title: "1. Information we collect",
          bullets: [
            "Account information, such as name, email address, role, language preference, and authentication identifiers.",
            "Company and professional information, such as company name, business role, location, website, job title, department, phone number, LinkedIn URL, and profile descriptions.",
            "Marketplace information, such as product listings, categories, pricing ranges, MOQ, lead times, documents, images, saved items, views, inquiries, messages, deals, and reviews.",
            "Files uploaded through the platform, including public listing images and private submitted documents or message attachments.",
            "Technical information, such as request metadata, device/browser information, security logs, rate-limit events, and basic analytics needed to operate the service.",
          ],
        },
        {
          title: "2. How we use information",
          bullets: [
            "To provide authentication, account, profile, marketplace, messaging, upload, review, and admin-management features.",
            "To display public company and product information that users choose to submit for listing.",
            "To protect the platform, investigate abuse, enforce terms, prevent spam, and maintain service reliability.",
            "To send operational messages or transactional notifications where configured.",
            "To improve product quality, localization, support, and marketplace workflows.",
          ],
        },
        {
          title: "3. Public and private information",
          paragraphs: [
            "Public listing information may be visible to visitors and users. Private documents, private message attachments, admin-only records, and non-public account data are intended for restricted access based on role and ownership.",
            "Users should avoid uploading unnecessary sensitive personal data. Trade82 does not ask users to submit payment card numbers, bank passwords, government login credentials, or unrelated personal documents through public forms.",
          ],
        },
        {
          title: "4. Service providers",
          paragraphs: [
            "Trade82 may use service providers such as Clerk for authentication, Supabase for database and storage, Vercel for hosting and logs, and an email provider such as Resend if transactional email is enabled.",
            "These providers process information as needed to operate the platform, maintain security, deliver messages, and provide infrastructure.",
          ],
        },
        {
          title: "5. Retention and security",
          paragraphs: [
            "Trade82 keeps records for as long as reasonably needed to provide the service, comply with legal obligations, resolve disputes, prevent abuse, and maintain business records.",
            "Trade82 uses access controls, private storage for restricted files, signed URLs for private file access, server-side authorization checks, file type restrictions, and rate limits. No online service can be made completely risk-free.",
          ],
        },
        {
          title: "6. User choices",
          paragraphs: [
            "Users may update account, professional, company, and product information through the account experience where available. Users may request assistance with privacy questions or account-related requests.",
            `For questions about Trade82, contact us at ${CONTACT_EMAIL}.`,
          ],
        },
      ],
    },
    business: {
      title: "Business Information",
      description:
        "Business and service information for Trade82 users.",
      updatedAt: "June 27, 2026",
      sections: [
        {
          title: "Trade82 service information",
          paragraphs: [
            "Trade82 is a B2B marketplace platform that connects Korean sellers with American buyers. Trade82 provides company information, product information, inquiries, messaging, and transaction communication features within the platform, but Trade82 is not a party to transactions between individual sellers and buyers.",
            "Each seller and buyer is responsible for product information, pricing, lead times, export/import requirements, submitted documents, payment terms, shipping terms, and transaction outcomes. Users should conduct their own due diligence, contract review, legal review, and payment-safety checks before entering into any transaction.",
            "Unless separately stated, Trade82 does not provide payment protection, escrow services, import approval, customs clearance, product compliance review, or any guarantee that a transaction will be completed.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            `Email: ${CONTACT_EMAIL}`,
            `For questions about Trade82, contact us at ${CONTACT_EMAIL}.`,
          ],
        },
      ],
    },
  },
  ko: {
    terms: {
      title: "서비스 이용약관",
      description: "Trade82 마켓플레이스 플랫폼 이용에 적용되는 기본 약관입니다.",
      updatedAt: "2026년 6월 27일",
      sections: [
        {
          title: "1. 서비스 개요",
          paragraphs: [
            "Trade82는 한국 셀러와 미국 바이어가 회사 프로필, 상품 정보, 문의, 메시지, 거래 관련 커뮤니케이션을 확인하고 관리할 수 있도록 돕는 B2B 마켓플레이스 플랫폼입니다.",
            "Trade82는 셀러와 바이어 간 개별 거래의 당사자가 아닙니다. 문의, 협의, 계약, 결제, 배송, 수출입, 사후 대응 여부와 조건은 각 거래 당사자가 직접 판단하고 책임집니다.",
          ],
        },
        {
          title: "2. 계정 및 이용 자격",
          paragraphs: [
            "이용자는 정확한 계정 정보를 제공하고 로그인 정보를 안전하게 관리해야 합니다. 계정을 통해 발생하는 활동에 대한 책임은 해당 이용자에게 있습니다.",
            "회사 계정을 사용하는 경우 해당 회사를 대표하거나 정보를 제출할 권한이 있어야 합니다. Trade82는 회사 또는 계정 정보가 불완전하거나 부정확하거나 안전하지 않다고 판단되는 경우 수정 요청, 공개 보류, 접근 제한 등의 조치를 할 수 있습니다.",
          ],
        },
        {
          title: "3. 회사 및 상품 정보",
          paragraphs: [
            "셀러와 바이어는 회사 프로필, 상품 설명, 가격, 재고 또는 공급 가능 여부, 납기, 법규 관련 정보, 제출 서류, 거래 커뮤니케이션의 정확성과 완전성에 대해 책임집니다.",
            "Trade82는 마켓플레이스 품질 관리를 위해 제출된 회사 프로필 정보를 검토할 수 있지만, 제품 주장, 결제 이행, 법규 준수, 통관 결과 또는 거래 결과를 보증하지 않습니다.",
          ],
        },
        {
          title: "4. 문의 및 메시지",
          paragraphs: [
            "문의, 메시지, 첨부파일, 거래 기록 기능은 소싱 상담을 정리하기 위한 도구입니다. 이용자는 불법, 허위, 오해를 유발하는 내용, 제3자의 비밀 정보, 악성 파일, 부적절한 내용을 플랫폼에 보내서는 안 됩니다.",
            "계약서, 인보이스, 결제 지시, 선적 서류 등 중요한 거래 자료는 플랫폼 외부에서도 별도로 보관하고 확인해야 합니다.",
          ],
        },
        {
          title: "5. 서류 및 첨부파일",
          paragraphs: [
            "이용자는 회사 제출 서류, 상품 자료, 메시지 첨부파일, 거래 관련 파일을 업로드할 수 있습니다. 이용자는 해당 파일을 업로드할 권한이 있어야 하며, 악성 파일, 실행 파일, 법령 또는 제3자 권리를 침해하는 파일을 업로드해서는 안 됩니다.",
            "비공개 파일은 제한된 접근을 전제로 합니다. 단, 이용자는 파일의 진위, 최신성, 법적 충분성을 거래 전에 직접 확인해야 합니다.",
          ],
        },
        {
          title: "6. 후기 및 공개 콘텐츠",
          paragraphs: [
            "후기와 공개 프로필 내용은 실제 비즈니스 상호작용에 기반해 사실대로 작성되어야 합니다. Trade82는 부적절하거나 오해를 유발하거나 관련성이 낮거나 불법 또는 안전하지 않은 콘텐츠를 숨기거나 제한할 수 있습니다.",
            "공개 후기와 공개 상태 표시는 마켓플레이스 운영 기능이며, 특정 거래의 성사나 결과를 약속하는 의미가 아닙니다.",
          ],
        },
        {
          title: "7. 금지 행위",
          bullets: [
            "사기, 사칭, 스팸, 악성 파일, 불법 거래 목적으로 플랫폼을 이용하는 행위",
            "허위, 오해 유발, 권한 없는 서류 또는 비밀 정보를 업로드하는 행위",
            "로그인 및 권한 확인, 요청 제한, 저장소 제한 또는 보안 장치를 우회하려는 행위",
            "Trade82 또는 이용자에게 피해를 줄 수 있는 방식으로 데이터를 수집, 복제, 재사용하는 행위",
          ],
        },
        {
          title: "8. 거래 결과에 대한 비보증",
          paragraphs: [
            "별도 서면 계약에서 명시하지 않는 한, Trade82는 결제 보호, 에스크로 서비스, 수입 허가, 통관, 법률 자문, 세무 자문, 제품 적합성 심사 또는 거래 성사를 제공하거나 보증하지 않습니다.",
            "이용자는 거래 전 자체 실사, 계약 검토, 법률 검토, 제품 관련 법규 검토, 결제 안전성 확인을 직접 진행해야 합니다.",
          ],
        },
        {
          title: "9. 변경, 제한 및 종료",
          paragraphs: [
            "Trade82는 서비스 운영, 이용자 보호, 법령 준수, 마켓플레이스 품질 관리를 위해 기능 변경, 공개 보류, 계정 제한, 콘텐츠 제한 등의 조치를 할 수 있습니다.",
            "이용자는 언제든 서비스 이용을 중단할 수 있습니다. 다만 보안, 법적 의무, 감사, 분쟁 대응, 서비스 연속성을 위해 필요한 기록은 일정 기간 보관될 수 있습니다.",
          ],
        },
        {
          title: "10. 문의",
          paragraphs: [
            `Trade82 관련 문의는 ${CONTACT_EMAIL} 으로 연락해주세요.`,
          ],
        },
      ],
    },
    sourcingTerms: {
      title: "소싱 및 거래지원 서비스 약관",
      description: "소싱 조율 및 거래지원 흐름에 적용되는 추가 약관입니다.",
      updatedAt: "2026년 6월 27일",
      sections: [
        {
          title: "1. 지원 범위",
          paragraphs: [
            "Trade82는 이용자가 소싱 문의, 메시지, 회사 정보, 상품 정보, 제출 서류, 거래 상태, 후기 요청을 정리할 수 있는 도구를 제공할 수 있습니다.",
            "별도의 서면 서비스 계약으로 구체적인 의무를 정하지 않는 한, 소싱 또는 거래지원 기능은 행정적이고 정보 제공적인 지원에 한정됩니다.",
          ],
        },
        {
          title: "2. 이용자의 책임",
          bullets: [
            "바이어는 상품 적합성, 수입 요건, 표시 요건, 결제 안전성, 공급자 신뢰성을 직접 확인해야 합니다.",
            "셀러는 상품 정보, 수출 준비 상태, 가격, 납기, 포장, 선적 조건, 서류 정확성을 직접 확인해야 합니다.",
            "양 당사자는 계약서, 인보이스, 결제 지시, 선적 서류, 관련 법령을 검토한 뒤 거래를 진행해야 합니다.",
          ],
        },
        {
          title: "3. 커뮤니케이션 및 연결",
          paragraphs: [
            "Trade82는 문의 전달 또는 메시지 정리를 도울 수 있습니다. 이러한 기능 제공만으로 Trade82가 바이어, 셀러, 수입자, 수출자, 통관 대리인, 운송 주선인, 결제 처리자 또는 계약 당사자가 되는 것은 아닙니다.",
            "이용자는 민감한 정보를 공유하거나 결제를 진행하기 전에 상대방의 신원, 권한, 신뢰성을 독립적으로 확인해야 합니다.",
          ],
        },
        {
          title: "4. 서류 및 거래 기록",
          paragraphs: [
            "업로드된 파일과 거래 기록은 이용자의 편의를 위한 정리 도구입니다. Trade82는 제출 서류의 완전성, 최신성, 진위, 법적 충분성 또는 정부기관, 물류사, 마켓플레이스, 은행, 거래 상대방의 수락 여부를 보증하지 않습니다.",
            "통관, 수입, 수출, 세무, 안전, 표시, 개인정보, 규제 관련 사항은 필요한 경우 전문가의 자문을 받아야 합니다.",
          ],
        },
        {
          title: "5. 수수료 및 별도 계약",
          paragraphs: [
            "Trade82가 향후 유료 소싱 또는 거래지원 서비스를 제공하는 경우, 수수료, 범위, 결과물, 취소 조건은 별도 서면 계약 또는 결제 화면에서 정해야 합니다.",
            "본 약관은 Trade82가 맞춤 소싱, 협상, 검사, 결제 처리, 물류, 분쟁 해결 서비스를 제공할 의무를 발생시키지 않습니다.",
          ],
        },
        {
          title: "6. 결과 비보장",
          paragraphs: [
            "Trade82는 바이어의 구매, 셀러의 이행, 서류 수락, 결제 완료, 통관, 거래 성사를 보증하지 않습니다.",
            "이용자는 자체 실사와 최종 사업 판단에 대해 책임집니다.",
          ],
        },
        {
          title: "7. 문의",
          paragraphs: [
            `Trade82 관련 문의는 ${CONTACT_EMAIL} 으로 연락해주세요.`,
          ],
        },
      ],
    },
    privacy: {
      title: "개인정보처리방침",
      description: "Trade82가 계정, 회사, 마켓플레이스, 커뮤니케이션, 파일 정보를 처리하는 방식입니다.",
      updatedAt: "2026년 6월 27일",
      sections: [
        {
          title: "1. 수집하는 정보",
          bullets: [
            "이름, 이메일 주소, 역할, 선호 언어, 인증 식별자 등 계정 정보",
            "회사명, 회사 역할, 위치, 웹사이트, 직함, 부서, 전화번호, LinkedIn URL, 프로필 설명 등 회사 및 인적사항",
            "상품 등록, 카테고리, 가격 범위, MOQ, 리드타임, 제출 서류, 이미지, 저장 항목, 조회, 문의, 메시지, 거래, 후기 등 마켓플레이스 정보",
            "공개 이미지, 비공개 제출 서류, 메시지 첨부파일 등 업로드 파일",
            "요청 메타데이터, 브라우저/기기 정보, 보안 로그, 요청 제한 기록, 서비스 운영에 필요한 기본 분석 정보",
          ],
        },
        {
          title: "2. 이용 목적",
          bullets: [
            "인증, 계정, 프로필, 마켓플레이스, 메시지, 업로드, 후기, 관리자 기능 제공",
            "이용자가 공개를 위해 제출한 회사 및 상품 정보 표시",
            "플랫폼 보호, 남용 조사, 약관 집행, 스팸 방지, 서비스 안정성 유지",
            "설정된 경우 운영 안내 또는 거래 관련 알림 발송",
            "제품 품질, 현지화, 지원, 마켓플레이스 흐름 개선",
          ],
        },
        {
          title: "3. 공개 정보와 비공개 정보",
          paragraphs: [
            "공개 등록 정보는 방문자와 이용자에게 표시될 수 있습니다. 비공개 서류, 비공개 메시지 첨부파일, 관리자 전용 기록, 비공개 계정 데이터는 역할과 소유권에 따라 제한적으로 접근됩니다.",
            "이용자는 불필요한 민감 개인정보를 업로드하지 않아야 합니다. Trade82는 공개 양식을 통해 카드번호, 은행 비밀번호, 정부기관 로그인 정보, 거래와 무관한 개인 서류 제출을 요구하지 않습니다.",
          ],
        },
        {
          title: "4. 서비스 제공자",
          paragraphs: [
            "Trade82는 인증을 위해 Clerk, 데이터베이스와 저장소를 위해 Supabase, 호스팅과 로그를 위해 Vercel, 거래성 이메일이 활성화된 경우 Resend와 같은 이메일 제공자를 사용할 수 있습니다.",
            "이러한 제공자는 플랫폼 운영, 보안 유지, 메시지 전달, 인프라 제공에 필요한 범위에서 정보를 처리합니다.",
          ],
        },
        {
          title: "5. 보관 및 보안",
          paragraphs: [
            "Trade82는 서비스 제공, 법적 의무 준수, 분쟁 해결, 남용 방지, 사업 기록 관리를 위해 합리적으로 필요한 기간 동안 기록을 보관합니다.",
            "Trade82는 접근 제어, 제한 파일을 위한 비공개 저장소, 비공개 파일 접근용 서명 URL, 서버 측 권한 확인, 파일 형식 제한, 요청 제한을 사용합니다. 온라인 서비스의 위험을 완전히 제거할 수는 없습니다.",
          ],
        },
        {
          title: "6. 이용자 선택권",
          paragraphs: [
            "이용자는 제공되는 계정 화면에서 계정, 인적사항, 회사, 상품 정보를 수정할 수 있습니다. 개인정보 또는 계정 관련 요청이 있는 경우 지원을 요청할 수 있습니다.",
            `Trade82 관련 문의는 ${CONTACT_EMAIL} 으로 연락해주세요.`,
          ],
        },
      ],
    },
    business: {
      title: "사업자 정보",
      description: "Trade82 이용자를 위한 사업자 및 서비스 안내입니다.",
      updatedAt: "2026년 6월 27일",
      sections: [
        {
          title: "Trade82 서비스 안내",
          paragraphs: [
            "Trade82는 한국 셀러와 미국 바이어를 연결하는 B2B 마켓플레이스 플랫폼입니다. Trade82는 플랫폼 내 회사 정보, 상품 정보, 문의 및 거래 커뮤니케이션 기능을 제공하지만, 개별 셀러와 바이어 간 거래의 당사자가 아닙니다.",
            "상품 정보, 가격, 납기, 수출입 요건, 제출 서류, 결제 조건, 배송 조건 및 거래 결과에 대한 책임은 각 거래 당사자에게 있습니다. 사용자는 거래 전 필요한 실사, 계약 검토, 법규 확인, 결제 안전성 확인을 직접 진행해야 합니다.",
            "Trade82는 별도로 명시하지 않는 한 결제 보호, 에스크로 서비스, 수입 허가, 통관, 제품 관련 법규 검토 또는 거래 성사를 제공하거나 보증하지 않습니다.",
          ],
        },
        {
          title: "문의",
          paragraphs: [
            `이메일: ${CONTACT_EMAIL}`,
            `Trade82 관련 문의는 ${CONTACT_EMAIL} 으로 연락해주세요.`,
          ],
        },
      ],
    },
  },
};

export function getLegalDocument(locale: Locale, key: LegalDocumentKey) {
  return legalDocuments[locale][key];
}
