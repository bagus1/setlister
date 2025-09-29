




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts









% this causes the variables to be defined...













% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "A Nightingale Sang in Berkeley Square" }
			\fill-line {
				"Lyrics by Eric Maschwitz"
				"Music by Manning Sherwin"
			}
			\fill-line {
				"Slowly"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong

	\partial 8 s8 |

	\repeat volta 2 {

		\myMark "A"
		\startPart
		ees2:maj7 c:m7 | g:m7 ees:7 | aes g:7 | c:m7 aes:m6 | \myEndLine
		ees:maj7 bes:7 | ees:7 aes4:m7 des:7 | ees2:maj7 c:m7 | f:m7 bes:7 | ees:6 c:m7 | \myEndLine
		f:m7 bes:7 |
		\endPart

		\myMark "A"
		\startPart
		ees:maj7 c:m7 | g:m7 ees:7 | aes:maj7 g:7 | c:m7 aes:m6 | \myEndLine
		ees:maj7 bes:7 | ees:7 aes4:m7 des:7 | ees2:maj7 c:m7 | f:m7 bes:7 | ees:6 c4:m7 c:m7/bes | a2:m7.5- d:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g e:m7 | a:m7 d4:7 d:7/c | b2:m7 bes:dim7 | a:m7 d:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g e:m7 | a:m7 d4:7 d:7/c | b2:m7 bes:dim7 | f:m7 bes:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		ees2:maj7 c:m7 | g:m7 ees:7 | aes g:7 | c:m7 aes:m6 | \myEndLine
		ees bes:7 | ees:7 aes4:m7 des:7 | ees,2 c:m7 | f:m7 bes:7 |
	} \alternative {
		{
			ees c:m7 | f:m7 bes:7 | \myEndLineVoltaNotLast
		}
		{
			ees c:m7 | f:m7 bes4:7 bes:7/aes | g2:m7.5- c:7 | f:m7.5- aes4/bes bes:7 | ees2 c4:m c:m7/bes | aes2:m6 ees:6 | \myEndLineVoltaLast
		}
	}
	\myEndLine
	\endPart

	\endSong
	\endChords
}



}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key ees \major

	\partial 8 bes8 |

	\repeat volta 2 {
		g'4 g ees4. ees8 | bes'4 bes g ees8 ees | \tuplet 3/2 { c'4 c c d d d } | ees2. ees8 ees |
		d4 bes c4. aes8 | bes4 ees, bes' aes8 aes | g aes bes4 ees, ees | ees2 f | ees1 |
		r2 r4 r8 bes | g'4 g ees4. ees8 | bes'4 bes g ees8 ees | \tuplet 3/2 { c'4 c c d d d } | ees2. ees4 |
		d4 bes c4. aes8 | bes4 ees, bes'4. aes8 | g aes bes4 ees, ees | ees2 f | ees1 | r |
		r8. d16 e8. fis16 g8. a16 b8. c16 | d8 d4 b8~ b4. b8 | a4 a fis4. fis8 | e4 e d2 |
		r8. d16 e8. fis16 g8. a16 b8. c16 | d8 d4 b8~ b4. b8 | a4 a g4. g8 | c4 c bes4. bes,8 |
		g'4 g ees4. ees8 | bes'4 bes g ees8 ees | \tuplet 3/2 { c'4 c c d d d } | ees2. ees4 | d bes c4. aes8 |
		bes4 ees, bes'4. aes8 | g8 aes bes4 ees, ees | ees2 f |
	} \alternative {
		{
			ees1~ | ees4 r r r8 bes8 |
		}
		{
			ees1 | r8 c' bes aes g4 f | g1 | r8 aes g f ees4 d | ees1~ ees2. r4 |
		}
	}
}


 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {
	That cer -- tain night, the night we met there was ma -- gic a -- broad in the air, there were
	an -- gels din -- in at the Ritz, and A Nigh -- in -- gale Sang In Ber -- k'ley Square.
	I may be right, I may be wrong, but I'm per -- fect -- ly will -- ing to swear that
	when you turn'd and smiled at me A Night -- in gale Sang In Ber -- k'ley Square.
	The moon that lin -- gered o -- ver Lon -- don town, __ poor Puz -- zled moon, he wore a frown.
	How could he know we two were so in love. __ The whole darn world seemed up -- side down, the
	streets of town were paved with stars. It was such a ro -- man -- tic af -- fair, and as we kiss'd and
	said "\"good" -- "night\"" A Night -- in gale Sang In Ber -- k'ley Square. __ How Square.
	I know, 'cause I was there that night in Ber -- k'ly Square. __
}


}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	





\lyricmode {
	_
	strange it ws, how sweet and strange. There was nev -- er a dream to com -- pare with that
	ha -- zy, cra -- zy night we met, when A Night -- in -- gale Sang In Ber -- k'ley Square.
	This heart of mine beat loud and fast like a mer -- ry -- go -- round in a fair. For
	we were dan -- cing cheek to cheek "and A" Night -- in -- gale Sang In Ber -- k'ley Square.
	When dawn came steal -- ing up all gold and blue __ to in -- ter -- rupt our ren -- dez -- vous,
	I still re -- mem -- ber how you smiled and said __ "\"was" that a dream of was it "true?\"" our
	home -- ward step was just as light as the tap -- dan -- cing feet of As -- taire and like an e -- cho
	far a -- way A Night -- in -- gale Sang In Ber -- k'ley Square. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong

	\partial 8 s8 |

	\repeat volta 2 {

		\myMark "A"
		\startPart
		ees2:maj7 c:m7 | g:m7 ees:7 | aes g:7 | c:m7 aes:m6 | \myEndLine
		ees:maj7 bes:7 | ees:7 aes4:m7 des:7 | ees2:maj7 c:m7 | f:m7 bes:7 | ees:6 c:m7 | \myEndLine
		f:m7 bes:7 |
		\endPart

		\myMark "A"
		\startPart
		ees:maj7 c:m7 | g:m7 ees:7 | aes:maj7 g:7 | c:m7 aes:m6 | \myEndLine
		ees:maj7 bes:7 | ees:7 aes4:m7 des:7 | ees2:maj7 c:m7 | f:m7 bes:7 | ees:6 c4:m7 c:m7/bes | a2:m7.5- d:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g e:m7 | a:m7 d4:7 d:7/c | b2:m7 bes:dim7 | a:m7 d:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g e:m7 | a:m7 d4:7 d:7/c | b2:m7 bes:dim7 | f:m7 bes:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		ees2:maj7 c:m7 | g:m7 ees:7 | aes g:7 | c:m7 aes:m6 | \myEndLine
		ees bes:7 | ees:7 aes4:m7 des:7 | ees,2 c:m7 | f:m7 bes:7 |
	} \alternative {
		{
			ees c:m7 | f:m7 bes:7 | \myEndLineVoltaNotLast
		}
		{
			ees c:m7 | f:m7 bes4:7 bes:7/aes | g2:m7.5- c:7 | f:m7.5- aes4/bes bes:7 | ees2 c4:m c:m7/bes | aes2:m6 ees:6 | \myEndLineVoltaLast
		}
	}
	\myEndLine
	\endPart

	\endSong
	\endChords
}




\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key ees \major

	\partial 8 bes8 |

	\repeat volta 2 {
		g'4 g ees4. ees8 | bes'4 bes g ees8 ees | \tuplet 3/2 { c'4 c c d d d } | ees2. ees8 ees |
		d4 bes c4. aes8 | bes4 ees, bes' aes8 aes | g aes bes4 ees, ees | ees2 f | ees1 |
		r2 r4 r8 bes | g'4 g ees4. ees8 | bes'4 bes g ees8 ees | \tuplet 3/2 { c'4 c c d d d } | ees2. ees4 |
		d4 bes c4. aes8 | bes4 ees, bes'4. aes8 | g aes bes4 ees, ees | ees2 f | ees1 | r |
		r8. d16 e8. fis16 g8. a16 b8. c16 | d8 d4 b8~ b4. b8 | a4 a fis4. fis8 | e4 e d2 |
		r8. d16 e8. fis16 g8. a16 b8. c16 | d8 d4 b8~ b4. b8 | a4 a g4. g8 | c4 c bes4. bes,8 |
		g'4 g ees4. ees8 | bes'4 bes g ees8 ees | \tuplet 3/2 { c'4 c c d d d } | ees2. ees4 | d bes c4. aes8 |
		bes4 ees, bes'4. aes8 | g8 aes bes4 ees, ees | ees2 f |
	} \alternative {
		{
			ees1~ | ees4 r r r8 bes8 |
		}
		{
			ees1 | r8 c' bes aes g4 f | g1 | r8 aes g f ees4 d | ees1~ ees2. r4 |
		}
	}
}



}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1951, Bourne Co. Copyright Renewed." }
	}
	\fill-line {
		\smaller \smaller { "Sole Selling Agent-Shapiro, Bernstein & Co., Inc., New York, NY" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Jordan Eldredge <jordan@jordaneldredge.com>, Built at 17:52:23 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





